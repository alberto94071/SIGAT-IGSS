"use client";
import { useState, useCallback, useRef, useLayoutEffect } from "react";
import { guardarPosicionesImpresion, getFondoImpresion } from "@/lib/impresion-posiciones-actions";
import { Campo, CAMPO_POSICIONABLE_CSS, type Pos } from "@/components/print-posiciones/CampoPosicionable";
import { PosicionesToolbar, HojaConFondo, HOJA_CON_FONDO_CSS } from "@/components/print-posiciones/PosicionesToolbar";

type Vale = {
  numero: number; tipo: string; motivo: string; monto: number; monto_autorizado: number | null;
  numero_cheque: string | null; destinatario_cheque: string | null; fecha_emision: string | null;
  solicitante_nombre: string; jefe_nombre: string;
};

interface Props {
  vale: Vale;
  montoEnLetras: string;
  municipio: string;
  codigoContable: string;
  posicionesGuardadas: Record<string, Pos>;
}

const HOJA_W_MM = 215.9;
const HOJA_H_MM = 279.4;

function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function partesFecha(iso: string | null): { dia: string; mes: string; anio: string } {
  if (!iso) return { dia: "", mes: "", anio: "" };
  const [anio, mes, dia] = iso.split("-");
  return { dia, mes, anio };
}

const TIPO_LABEL: Record<string, string> = { pasajes: "Vale de Pago de Pasajes", gastos_varios: "Vale de Gastos Varios" };

// Posiciones por defecto (mm) — arrancan de las coordenadas que ya se usaban
// en el sistema anterior de ajuste fino (OverlayField, en pulgadas), solo
// convertidas a mm; se afinan y guardan desde el modo "Ver posiciones".
const POS_DEFAULT: Record<string, Pos> = {
  numero_cheque: { top: 5.6,   left: 154.9, width: 38, height: 5 },
  lugar_fecha:   { top: 19.8,  left: 50.8,  width: 110, height: 5 },
  monto_cheque:  { top: 19.8,  left: 161.3, width: 30, height: 5 },
  destinatario:  { top: 29.2,  left: 50.8,  width: 150, height: 5 },
  monto_letras:  { top: 36.8,  left: 40.6,  width: 163, height: 6 },
  cuenta_no:     { top: 96.0,  left: 15.2,  width: 25, height: 5 },
  concepto:      { top: 96.0,  left: 43.2,  width: 99, height: 5 },
  monto_stub:    { top: 96.0,  left: 148.6, width: 22, height: 5 },
  solicitante:   { top: 199.4, left: 14.0,  width: 38, height: 5 },
  jefe:          { top: 199.4, left: 104.1, width: 48, height: 5 },
  dia:           { top: 199.4, left: 191.8, width: 6,  height: 5 },
  mes:           { top: 199.4, left: 199.4, width: 6,  height: 5 },
  anio:          { top: 199.4, left: 207.0, width: 9,  height: 5 },
};

const FIELD_LABELS: Record<string, string> = {
  numero_cheque: "No. de cheque",
  lugar_fecha:   "Lugar y fecha",
  monto_cheque:  "Monto (Q., cuerpo del cheque)",
  destinatario:  "Pago a la orden de",
  monto_letras:  "Suma de (en letras)",
  cuenta_no:     "Cuenta No. (voucher)",
  concepto:      "Concepto (voucher)",
  monto_stub:    "Monto (voucher, debe/haber)",
  solicitante:   "Nombre del solicitante",
  jefe:          "Nombre del Jefe",
  dia:           "Día",
  mes:           "Mes",
  anio:          "Año",
};

export default function ImprimirVoucherClient({
  vale: v, montoEnLetras, municipio, codigoContable, posicionesGuardadas,
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

  const monto = v.monto_autorizado ?? v.monto;
  const montoTxt = monto.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { dia, mes, anio } = partesFecha(v.fecha_emision);

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
        titulo={`Voucher — Cheque ${v.numero_cheque}`}
        verPosiciones={verPosiciones} onToggleVer={() => setVerPosiciones(p => !p)}
        onRestablecer={restablecerPosiciones} onGuardar={guardarPosiciones}
        guardando={guardando} guardado={guardado}
      />

      <HojaConFondo hojaRef={hojaRef} fondo={fondo}>
        {campo("numero_cheque", v.numero_cheque ?? "", { style: { textAlign: "right", fontWeight: "bold", fontFamily: "monospace" } })}
        {campo("lugar_fecha", `${municipio}, ${fechaCorta(v.fecha_emision)}`)}
        {campo("monto_cheque", montoTxt, { style: { textAlign: "right", fontWeight: "bold" } })}
        {campo("destinatario", v.destinatario_cheque ?? "")}
        {campo("monto_letras", montoEnLetras, { style: { fontSize: "8.5pt" } })}

        {campo("cuenta_no", codigoContable, { style: { textAlign: "center", fontSize: "8pt" } })}
        {campo("concepto", `${TIPO_LABEL[v.tipo] ?? v.tipo} No. ${String(v.numero).padStart(7, "0")} — ${v.motivo}`, { style: { fontSize: "8.5pt" } })}
        {campo("monto_stub", montoTxt, { style: { textAlign: "right", fontFamily: "monospace", fontSize: "8.5pt" } })}

        {campo("solicitante", v.solicitante_nombre, { style: { fontSize: "7.5pt" } })}
        {campo("jefe", v.jefe_nombre, { style: { fontSize: "7.5pt" } })}
        {campo("dia", dia, { style: { textAlign: "center", fontSize: "7.5pt" } })}
        {campo("mes", mes, { style: { textAlign: "center", fontSize: "7.5pt" } })}
        {campo("anio", anio, { style: { textAlign: "center", fontSize: "7.5pt" } })}
      </HojaConFondo>

      <style>{HOJA_CON_FONDO_CSS}</style>
      {verPosiciones && <style>{CAMPO_POSICIONABLE_CSS}</style>}
    </>
  );
}
