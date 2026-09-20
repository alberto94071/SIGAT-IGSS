"use client";
import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { guardarPosicionesImpresion, getFondoImpresion } from "@/lib/impresion-posiciones-actions";
import { Campo, CAMPO_POSICIONABLE_CSS, CAMPO_HIDE_BTN_CSS, type Pos } from "@/components/print-posiciones/CampoPosicionable";
import { PosicionesToolbar, HojaConFondo, HOJA_CON_FONDO_CSS } from "@/components/print-posiciones/PosicionesToolbar";

// Misma clave que ImprimirVoucherClient.tsx (Voucher de Vale) — es el mismo
// talonario físico, ver comentario ahí. Preferencia por navegador, no por
// documento impreso — mismo patrón que DAB-60.
const OCULTOS_KEY = "cip-voucher-campos-ocultos";

type Pago = {
  numero_cheque: string; fecha_emision_cheque: string | null;
  monto_cheque: number; monto_letras: string; destinatario_nombre: string; concepto_voucher: string;
  numero_a04: number | null; anio_a04: number | null;
  tipo_documento_pago: string | null;
  no_factura: string; serie_factura: string;
  nit_beneficiario: string | null;
};

interface Props {
  pago: Pago;
  municipio: string;
  bancoNombre: string;
  cuentaNumero: string;
  cuentaNombre: string;
  saldoAnterior: number | null;
  saldoNuevo: number | null;
  posicionesGuardadas: Record<string, Pos>;
}

const HOJA_W_MM = 215.9;
const HOJA_H_MM = 279.4;

function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Mismas posiciones/fondo ("cheque") que el Voucher de Vale de Caja Chica —
// es el mismo talonario físico, solo que los datos vienen de un pago de
// Fondo Rotativo/Bancos (Regularizado) en vez de un vale.
//
// HECHO POR / REVISADO / AUTORIZADO / RECIBÍ CONFORME / DIA-MES-AÑO quedan
// sin texto por defecto (ver campo() más abajo) — son para llenar a mano,
// según pidió el cliente; antes acá se autorellenaba solicitante/jefe.
const POS_DEFAULT: Record<string, Pos> = {
  numero_cheque:   { top: 5.6,   left: 154.9, width: 38, height: 5 },
  lugar_fecha:     { top: 19.8,  left: 50.8,  width: 110, height: 5 },
  monto_cheque:    { top: 19.8,  left: 161.3, width: 30, height: 5 },
  destinatario:    { top: 29.2,  left: 50.8,  width: 150, height: 5 },
  monto_letras:    { top: 36.8,  left: 40.6,  width: 163, height: 6 },
  banco_datos:     { top: 83.0,  left: 15.2,  width: 163, height: 6 },
  cuenta_no:       { top: 96.0,  left: 15.2,  width: 25, height: 5 },
  concepto:        { top: 96.0,  left: 43.2,  width: 99, height: 5 },
  debe:            { top: 96.0,  left: 148.6, width: 22, height: 5 },
  haber:           { top: 96.0,  left: 172.6, width: 22, height: 5 },
  tipo_documento_header:  { top: 99.5,  left: 15.2,  width: 30, height: 4 },
  numero_documento_header:{ top: 99.5,  left: 47.2,  width: 25, height: 4 },
  serie_documento_header: { top: 99.5,  left: 74.2,  width: 25, height: 4 },
  tipo_documento:  { top: 103.0, left: 15.2,  width: 30, height: 5 },
  numero_documento:{ top: 103.0, left: 47.2,  width: 25, height: 5 },
  serie_documento: { top: 103.0, left: 74.2,  width: 25, height: 5 },
  saldo_anterior:  { top: 110.0, left: 43.2,  width: 60, height: 5 },
  saldo_nuevo:     { top: 110.0, left: 105.2, width: 60, height: 5 },
  pago_orden_de:   { top: 188.0, left: 14.0,  width: 130, height: 5 },
  pago_orden_nit:  { top: 188.0, left: 150.0, width: 50, height: 5 },
  hecho_por:       { top: 199.4, left: 14.0,  width: 38, height: 5 },
  revisado:        { top: 199.4, left: 60.0,  width: 38, height: 5 },
  autorizado:      { top: 199.4, left: 104.1, width: 38, height: 5 },
  recibi_conforme: { top: 199.4, left: 150.0, width: 38, height: 5 },
  dia:             { top: 199.4, left: 191.8, width: 6,  height: 5 },
  mes:             { top: 199.4, left: 199.4, width: 6,  height: 5 },
  anio:            { top: 199.4, left: 207.0, width: 9,  height: 5 },
};

const FIELD_LABELS: Record<string, string> = {
  numero_cheque:   "No. de cheque",
  lugar_fecha:     "Lugar y fecha",
  monto_cheque:    "Monto (Q., cuerpo del cheque)",
  destinatario:    "Pago a la orden de",
  monto_letras:    "Suma de (en letras)",
  banco_datos:     "Banco / cuenta (dato fijo)",
  cuenta_no:       "Número de cuenta (voucher)",
  concepto:        "Concepto (voucher)",
  debe:            "Debe",
  haber:           "Haber",
  tipo_documento_header:   "Encabezado columna — Según Documento(s)",
  numero_documento_header: "Encabezado columna — Número",
  serie_documento_header:  "Encabezado columna — Serie",
  tipo_documento:  "Según Documento(s) — Tipo",
  numero_documento:"Según Documento(s) — Número",
  serie_documento: "Según Documento(s) — Serie",
  saldo_anterior:  "Saldo anterior",
  saldo_nuevo:     "Saldo nuevo",
  pago_orden_de:   "Pago a la orden de (pie, con NIT)",
  pago_orden_nit:  "NIT del beneficiario (pie)",
  hecho_por:       "Hecho por (en blanco)",
  revisado:        "Revisado (en blanco)",
  autorizado:      "Autorizado (en blanco)",
  recibi_conforme: "Recibí conforme (en blanco)",
  dia:             "Día (en blanco)",
  mes:             "Mes (en blanco)",
  anio:            "Año (en blanco)",
};

export default function ImprimirVoucherBancosClient({
  pago: p, municipio, bancoNombre, cuentaNumero, cuentaNombre,
  saldoAnterior, saldoNuevo, posicionesGuardadas,
}: Props) {
  const [verPosiciones, setVerPosiciones] = useState(false);
  const [pos, setPos] = useState<Record<string, Pos>>({ ...POS_DEFAULT, ...posicionesGuardadas });
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [fondo, setFondo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [ocultos, setOcultos] = useState<string[]>([]);
  const hojaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(OCULTOS_KEY);
      if (raw) setOcultos(JSON.parse(raw));
    } catch { /* localStorage no disponible — sigue mostrando todo */ }
  }, []);

  const ocultarCampo = useCallback((id: string) => {
    setOcultos(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try { localStorage.setItem(OCULTOS_KEY, JSON.stringify(next)); } catch { /* ignorar */ }
      return next;
    });
  }, []);

  function reiniciarOcultos() {
    setOcultos([]);
    try { localStorage.removeItem(OCULTOS_KEY); } catch { /* ignorar */ }
  }

  useLayoutEffect(() => {
    if (!fondo) getFondoImpresion("cheque").then(setFondo);
  }, [fondo]);

  const onChangePos = useCallback((id: string, next: Pos) => {
    setPos(p => ({ ...p, [id]: next }));
  }, []);
  const onTextChange = useCallback((id: string, texto: string) => {
    setOverrides(o => ({ ...o, [id]: texto }));
  }, []);

  async function guardarPosiciones() {
    setGuardando(true);
    await guardarPosicionesImpresion("cheque", pos);
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  }
  function restablecerPosiciones() {
    setPos({ ...POS_DEFAULT });
  }

  const fmtQ = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const montoTxt = p.monto_cheque.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const bancoDatosTxt = [bancoNombre, cuentaNombre, cuentaNumero].filter(Boolean).join(" · ");

  const campo = (id: string, textoDefault: string, opts?: { style?: React.CSSProperties }) => {
    if (ocultos.includes(id)) return null;
    const texto = overrides[id] ?? textoDefault;
    return (
      <Campo
        id={id} texto={texto} hojaRef={hojaRef} hojaWMm={HOJA_W_MM} hojaHMm={HOJA_H_MM}
        pos={pos[id] ?? POS_DEFAULT[id]} onChange={onChangePos}
        editable={verPosiciones} style={opts?.style} label={FIELD_LABELS[id] ?? id}
        onTextChange={onTextChange}
        onHide={() => ocultarCampo(id)}
      />
    );
  };

  return (
    <>
      <PosicionesToolbar
        titulo={`Voucher — Cheque ${p.numero_cheque}`}
        verPosiciones={verPosiciones} onToggleVer={() => setVerPosiciones(v => !v)}
        onRestablecer={restablecerPosiciones} onGuardar={guardarPosiciones}
        guardando={guardando} guardado={guardado}
        ocultosCount={ocultos.length} onReiniciarOcultos={reiniciarOcultos}
      />

      <HojaConFondo hojaRef={hojaRef} fondo={fondo}>
        {campo("numero_cheque", p.numero_cheque, { style: { textAlign: "right", fontWeight: "bold", fontFamily: "monospace" } })}
        {campo("lugar_fecha", `${municipio}, ${fechaCorta(p.fecha_emision_cheque)}`)}
        {campo("monto_cheque", montoTxt, { style: { textAlign: "right", fontWeight: "bold" } })}
        {campo("destinatario", p.destinatario_nombre)}
        {campo("monto_letras", p.monto_letras, { style: { fontSize: "8.5pt" } })}

        {campo("banco_datos", bancoDatosTxt, { style: { fontSize: "7.5pt", color: "#444" } })}
        {campo("cuenta_no", cuentaNumero, { style: { textAlign: "center", fontSize: "8pt" } })}
        {campo("concepto", p.concepto_voucher, { style: { fontSize: "8.5pt" } })}
        {campo("debe", montoTxt, { style: { textAlign: "right", fontFamily: "monospace", fontSize: "8.5pt" } })}
        {campo("haber", "", { style: { textAlign: "right", fontFamily: "monospace", fontSize: "8.5pt" } })}

        {/* "Según Documento(s)" — tipo de documento elegido al completar el
            Voucher (Factura/Vale/Formulario) + el número/serie de la
            factura que respalda la compra. No. y Serie solo se imprimen
            cuando el tipo es "Factura" (pedido explícito del cliente); para
            Vale/Formulario no hay un número/serie propio capturado en este
            punto del flujo, así que quedan en blanco. Los 3 encabezados de
            columna van fijos arriba de cada dato (pedido del cliente). */}
        {campo("tipo_documento_header", "Según Documento(s)", { style: { fontSize: "6.5pt", fontWeight: "bold", textDecoration: "underline" } })}
        {campo("numero_documento_header", "Número", { style: { fontSize: "6.5pt", fontWeight: "bold", textDecoration: "underline" } })}
        {campo("serie_documento_header", "Serie", { style: { fontSize: "6.5pt", fontWeight: "bold", textDecoration: "underline" } })}
        {campo("tipo_documento", p.tipo_documento_pago ?? "", { style: { fontSize: "7.5pt" } })}
        {campo("numero_documento", p.tipo_documento_pago?.includes("Factura") ? p.no_factura : "", { style: { fontSize: "7.5pt" } })}
        {campo("serie_documento", p.tipo_documento_pago?.includes("Factura") ? p.serie_factura : "", { style: { fontSize: "7.5pt" } })}

        {campo("saldo_anterior", saldoAnterior != null ? `Saldo anterior: ${fmtQ(saldoAnterior)}` : "", { style: { fontSize: "7.5pt", color: "#444" } })}
        {campo("saldo_nuevo", saldoNuevo != null ? `Saldo nuevo: ${fmtQ(saldoNuevo)}` : "", { style: { fontSize: "7.5pt", color: "#444" } })}

        {/* Pie del voucher (parte baja de la hoja, no la línea "páguese a la
            orden de" del cheque en sí, que ya viene pre-impresa en el
            talonario) — pedido explícito del cliente: repetir a quién se le
            extendió el cheque, con su NIT, hasta abajo del documento. */}
        {campo("pago_orden_de", `PAGO A LA ORDEN DE: ${p.destinatario_nombre}`, { style: { fontSize: "8pt", fontWeight: "bold" } })}
        {campo("pago_orden_nit", `NIT: ${p.nit_beneficiario ?? ""}`, { style: { fontSize: "8pt" } })}

        {/* Hecho por / Revisado / Autorizado / Recibí conforme / Día-Mes-Año
            quedan en blanco a propósito — se llenan a mano al recibir el cheque. */}
        {campo("hecho_por", "", { style: { fontSize: "7.5pt" } })}
        {campo("revisado", "", { style: { fontSize: "7.5pt" } })}
        {campo("autorizado", "", { style: { fontSize: "7.5pt" } })}
        {campo("recibi_conforme", "", { style: { fontSize: "7.5pt" } })}
        {campo("dia", "", { style: { textAlign: "center", fontSize: "7.5pt" } })}
        {campo("mes", "", { style: { textAlign: "center", fontSize: "7.5pt" } })}
        {campo("anio", "", { style: { textAlign: "center", fontSize: "7.5pt" } })}
      </HojaConFondo>

      <style>{HOJA_CON_FONDO_CSS}</style>
      <style>{CAMPO_HIDE_BTN_CSS}</style>
      {verPosiciones && <style>{CAMPO_POSICIONABLE_CSS}</style>}
    </>
  );
}
