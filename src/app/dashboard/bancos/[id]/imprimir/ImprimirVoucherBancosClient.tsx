"use client";
import { useState, useCallback, useRef, useLayoutEffect } from "react";
import { guardarPosicionesImpresion, getFondoImpresion } from "@/lib/impresion-posiciones-actions";
import { Campo, CAMPO_POSICIONABLE_CSS, type Pos } from "@/components/print-posiciones/CampoPosicionable";
import { PosicionesToolbar, HojaConFondo, HOJA_CON_FONDO_CSS } from "@/components/print-posiciones/PosicionesToolbar";

type Pago = {
  numero_cheque: string; fecha_emision_cheque: string | null;
  monto_cheque: number; monto_letras: string; destinatario_nombre: string; concepto_voucher: string;
  numero_a04: number | null; anio_a04: number | null;
};

interface Props {
  pago: Pago;
  municipio: string;
  codigoContable: string;
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
  saldo_anterior:  { top: 103.0, left: 43.2,  width: 60, height: 5 },
  saldo_nuevo:     { top: 103.0, left: 105.2, width: 60, height: 5 },
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
  cuenta_no:       "Cuenta No. contable (voucher)",
  concepto:        "Concepto (voucher)",
  debe:            "Debe",
  haber:           "Haber",
  saldo_anterior:  "Saldo anterior",
  saldo_nuevo:     "Saldo nuevo",
  hecho_por:       "Hecho por (en blanco)",
  revisado:        "Revisado (en blanco)",
  autorizado:      "Autorizado (en blanco)",
  recibi_conforme: "Recibí conforme (en blanco)",
  dia:             "Día (en blanco)",
  mes:             "Mes (en blanco)",
  anio:            "Año (en blanco)",
};

export default function ImprimirVoucherBancosClient({
  pago: p, municipio, codigoContable, bancoNombre, cuentaNumero, cuentaNombre,
  saldoAnterior, saldoNuevo, posicionesGuardadas,
}: Props) {
  const [verPosiciones, setVerPosiciones] = useState(false);
  const [pos, setPos] = useState<Record<string, Pos>>({ ...POS_DEFAULT, ...posicionesGuardadas });
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [fondo, setFondo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const hojaRef = useRef<HTMLDivElement>(null);

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
    const texto = overrides[id] ?? textoDefault;
    return (
      <Campo
        id={id} texto={texto} hojaRef={hojaRef} hojaWMm={HOJA_W_MM} hojaHMm={HOJA_H_MM}
        pos={pos[id] ?? POS_DEFAULT[id]} onChange={onChangePos}
        editable={verPosiciones} style={opts?.style} label={FIELD_LABELS[id] ?? id}
        onTextChange={onTextChange}
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
      />

      <HojaConFondo hojaRef={hojaRef} fondo={fondo}>
        {campo("numero_cheque", p.numero_cheque, { style: { textAlign: "right", fontWeight: "bold", fontFamily: "monospace" } })}
        {campo("lugar_fecha", `${municipio}, ${fechaCorta(p.fecha_emision_cheque)}`)}
        {campo("monto_cheque", montoTxt, { style: { textAlign: "right", fontWeight: "bold" } })}
        {campo("destinatario", p.destinatario_nombre)}
        {campo("monto_letras", p.monto_letras, { style: { fontSize: "8.5pt" } })}

        {campo("banco_datos", bancoDatosTxt, { style: { fontSize: "7.5pt", color: "#444" } })}
        {campo("cuenta_no", codigoContable, { style: { textAlign: "center", fontSize: "8pt" } })}
        {campo("concepto", p.concepto_voucher, { style: { fontSize: "8.5pt" } })}
        {campo("debe", montoTxt, { style: { textAlign: "right", fontFamily: "monospace", fontSize: "8.5pt" } })}
        {campo("haber", "", { style: { textAlign: "right", fontFamily: "monospace", fontSize: "8.5pt" } })}
        {campo("saldo_anterior", saldoAnterior != null ? `Saldo anterior: ${fmtQ(saldoAnterior)}` : "", { style: { fontSize: "7.5pt", color: "#444" } })}
        {campo("saldo_nuevo", saldoNuevo != null ? `Saldo nuevo: ${fmtQ(saldoNuevo)}` : "", { style: { fontSize: "7.5pt", color: "#444" } })}

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
      {verPosiciones && <style>{CAMPO_POSICIONABLE_CSS}</style>}
    </>
  );
}
