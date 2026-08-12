"use client";
import { useState, useCallback, useRef, useLayoutEffect } from "react";
import { montoEnLetras } from "@/lib/adjudicacion/deletreo";
import { guardarPosicionesImpresion, getFondoImpresion } from "@/lib/impresion-posiciones-actions";
import { Campo, CAMPO_POSICIONABLE_CSS, type Pos } from "@/components/print-posiciones/CampoPosicionable";
import { PosicionesToolbar, HojaConFondo, HOJA_CON_FONDO_CSS } from "@/components/print-posiciones/PosicionesToolbar";

type Vale = {
  id: number; numero: number; fecha: string; monto: number; monto_autorizado: number | null; motivo: string;
  solicitante_nombre: string; solicitante_numero_empleado: string; solicitante_nit: string;
  jefe_nombre: string; jefe_numero_empleado: string; jefe_nit: string;
  numero_cheque: string | null; fecha_emision: string | null; fecha_entregado: string | null;
};

interface Props {
  vale: Vale;
  municipio: string; nombreDependencia: string;
  nombreResponsable: string; numeroEmpleadoResp: string; nitResponsable: string;
  posicionesGuardadas: Record<string, Pos>;
}

const HOJA_W_MM = 215.9;
const HOJA_H_MM = 279.4;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}
function fechaNumerica(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Posiciones por defecto (mm desde la esquina superior izquierda de la hoja
// carta) — punto de partida estimado contra el formulario real; se ajusta y
// se guarda desde el modo "Ver posiciones".
const POS_DEFAULT: Record<string, Pos> = {
  numero:              { top: 38,  left: 178, width: 30,  height: 8 },
  monto:               { top: 50,  left: 160, width: 45,  height: 8 },
  lugar_fecha:         { top: 58,  left: 36 },
  dependencia:         { top: 72,  left: 68,  width: 130, height: 10 },
  cantidad_letras:     { top: 89,  left: 24,  width: 185, height: 8 },
  motivo:              { top: 99,  left: 45,  width: 160, height: 10 },
  solicitante_nombre:  { top: 129, left: 43 },
  solicitante_empleado:{ top: 135, left: 43 },
  solicitante_nit:     { top: 140, left: 43 },
  jefe_nombre:         { top: 129, left: 125 },
  jefe_empleado:       { top: 135, left: 125 },
  jefe_nit:            { top: 140, left: 125 },
  responsable_nombre:  { top: 168, left: 43 },
  responsable_empleado:{ top: 174, left: 43 },
  responsable_nit:     { top: 179, left: 43 },
  cheque_no:           { top: 158, left: 148, width: 35, height: 6 },
  valor_q:             { top: 164, left: 148, width: 35, height: 6 },
  fecha_emision:       { top: 170, left: 148, width: 35, height: 6 },
  fecha_entregado:     { top: 176, left: 148, width: 35, height: 6 },
};

const FIELD_LABELS: Record<string, string> = {
  numero:               "No. de vale",
  monto:                "Por Q. (monto)",
  lugar_fecha:          "Lugar y fecha",
  dependencia:          "Vale al Fondo Rotativo Interno de",
  cantidad_letras:      "La cantidad de (en letras)",
  motivo:               "Motivo",
  solicitante_nombre:   "Nombres y apellidos del solicitante",
  solicitante_empleado: "Número de Empleado del solicitante",
  solicitante_nit:      "NIT del solicitante",
  jefe_nombre:          "Nombres y apellidos del Jefe",
  jefe_empleado:        "Número de Empleado del Jefe",
  jefe_nit:             "NIT del Jefe",
  responsable_nombre:   "Nombres y apellidos del responsable del Fondo Rotativo",
  responsable_empleado: "Número de Empleado del responsable",
  responsable_nit:      "NIT del responsable",
  cheque_no:            "Cheque No.",
  valor_q:              "Valor Q.",
  fecha_emision:        "Fecha de emisión",
  fecha_entregado:      "Entregado el",
};

export default function ImprimirValeClient({
  vale: v, municipio, nombreDependencia, nombreResponsable, numeroEmpleadoResp, nitResponsable, posicionesGuardadas,
}: Props) {
  const [verPosiciones, setVerPosiciones] = useState(false);
  const [pos, setPos] = useState<Record<string, Pos>>({ ...POS_DEFAULT, ...posicionesGuardadas });
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [fondo, setFondo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const hojaRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!fondo) getFondoImpresion("vale").then(setFondo);
  }, [fondo]);

  const onChangePos = useCallback((id: string, next: Pos) => {
    setPos(p => ({ ...p, [id]: next }));
  }, []);
  const onTextChange = useCallback((id: string, texto: string) => {
    setOverrides(o => ({ ...o, [id]: texto }));
  }, []);

  async function guardarPosiciones() {
    setGuardando(true);
    await guardarPosicionesImpresion("vale", pos);
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  }
  function restablecerPosiciones() {
    setPos({ ...POS_DEFAULT });
  }

  const correlativo = String(v.numero).padStart(7, "0");
  const monto = v.monto_autorizado ?? v.monto;

  const campo = (id: string, textoDefault: string, opts?: { style?: React.CSSProperties; multiline?: boolean }) => {
    const texto = overrides[id] ?? textoDefault;
    return (
      <Campo
        id={id} texto={texto} hojaRef={hojaRef} hojaWMm={HOJA_W_MM} hojaHMm={HOJA_H_MM}
        pos={pos[id] ?? POS_DEFAULT[id]} onChange={onChangePos}
        editable={verPosiciones} style={opts?.style} label={FIELD_LABELS[id] ?? id}
        onTextChange={onTextChange} multiline={opts?.multiline}
      />
    );
  };

  return (
    <>
      <PosicionesToolbar
        titulo={`Vale de Caja Chica — ${correlativo}`}
        verPosiciones={verPosiciones} onToggleVer={() => setVerPosiciones(p => !p)}
        onRestablecer={restablecerPosiciones} onGuardar={guardarPosiciones}
        guardando={guardando} guardado={guardado}
      />

      <HojaConFondo hojaRef={hojaRef} fondo={fondo}>
        {campo("numero", correlativo, { style: { fontWeight: "bold", fontSize: "13pt", fontFamily: "monospace" } })}
        {campo("monto", monto.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), { style: { fontWeight: "bold", fontSize: "12pt" } })}
        {campo("lugar_fecha", `${municipio}, ${fechaCorta(v.fecha)}`)}
        {campo("dependencia", `${nombreDependencia}.`, { multiline: true })}
        {campo("cantidad_letras", montoEnLetras(monto))}
        {campo("motivo", v.motivo, { multiline: true })}

        {campo("solicitante_nombre", v.solicitante_nombre)}
        {campo("solicitante_empleado", v.solicitante_numero_empleado)}
        {campo("solicitante_nit", v.solicitante_nit)}
        {campo("jefe_nombre", v.jefe_nombre)}
        {campo("jefe_empleado", v.jefe_numero_empleado)}
        {campo("jefe_nit", v.jefe_nit)}

        {campo("responsable_nombre", nombreResponsable)}
        {campo("responsable_empleado", numeroEmpleadoResp)}
        {campo("responsable_nit", nitResponsable)}

        {campo("cheque_no", v.numero_cheque ?? "")}
        {campo("valor_q", Q(monto))}
        {campo("fecha_emision", fechaNumerica(v.fecha_emision))}
        {campo("fecha_entregado", fechaNumerica(v.fecha_entregado))}
      </HojaConFondo>

      <style>{HOJA_CON_FONDO_CSS}</style>
      {verPosiciones && <style>{CAMPO_POSICIONABLE_CSS}</style>}
    </>
  );
}

function Q(n: number): string {
  return `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
