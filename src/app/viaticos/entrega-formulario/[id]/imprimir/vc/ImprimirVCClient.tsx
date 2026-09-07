"use client";
import { useState, useCallback, useRef, useLayoutEffect } from "react";
import { guardarPosicionesImpresion, getFondoImpresion } from "@/lib/impresion-posiciones-actions";
import { Campo, CAMPO_POSICIONABLE_CSS, type Pos } from "@/components/print-posiciones/CampoPosicionable";
import { PosicionesToolbar, HojaConFondo, HOJA_CON_FONDO_CSS } from "@/components/print-posiciones/PosicionesToolbar";

const HOJA_W_MM = 215.9;
const HOJA_H_MM = 279.4;
const IN = 25.4;

// El cliente pidió que el V-C (Viático Constancia) solo lleve el encabezado
// (casillas 1-7: datos del trabajador, dependencia, nombramiento/fecha) — la
// tabla "Permaneció en comisión oficial..." (8-14, Llegada/Salida/Autoridad/
// Firma) se llena a mano en el lugar de destino, no la toca el sistema.
// Posiciones (mm) convertidas del calibrado original en pulgadas — ahora
// ajustables/arrastrables y persistentes (2026-09-07, mismo sistema del
// DAB-60), ya no fijas en el código.
const POS_DEFAULT: Record<string, Pos> = {
  persona_nombre:      { top: 2.82 * IN, left: 1.05 * IN, width: 6.25 * IN },
  persona_cargo:       { top: 3.11 * IN, left: 0.85 * IN, width: 6.45 * IN },
  persona_nit:         { top: 3.40 * IN, left: 0.75 * IN, width: 3.2 * IN },
  persona_no_empleado: { top: 3.40 * IN, left: 5.95 * IN, width: 1.35 * IN },
  dependencia:         { top: 3.69 * IN, left: 1.40 * IN, width: 5.9 * IN },
  nombramiento:        { top: 3.98 * IN, left: 1.60 * IN, width: 2.7 * IN },
  fecha_nombramiento:  { top: 3.98 * IN, left: 5.05 * IN, width: 2.25 * IN },
};

const FIELD_LABELS: Record<string, string> = {
  persona_nombre:      "Nombre",
  persona_cargo:        "Cargo",
  persona_nit:          "NIT",
  persona_no_empleado:  "Número de empleado",
  dependencia:          "Dependencia",
  nombramiento:         "Nombramiento(s)",
  fecha_nombramiento:   "Fecha(s) de nombramiento",
};

function fechaCorta(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface Props {
  numeroFormulario: string | null; personaNombre: string | null; personaCargo: string | null;
  personaNit: string | null; personaNoEmpleado: string | null; dependencia: string;
  nombramientos: { numero: string; fecha: string }[];
  posicionesGuardadas: Record<string, Pos>;
}

export default function ImprimirVCClient({
  numeroFormulario, personaNombre, personaCargo, personaNit, personaNoEmpleado, dependencia, nombramientos,
  posicionesGuardadas,
}: Props) {
  const [verPosiciones, setVerPosiciones] = useState(false);
  const [pos, setPos] = useState<Record<string, Pos>>({ ...POS_DEFAULT, ...posicionesGuardadas });
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [fondo, setFondo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const hojaRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!fondo) getFondoImpresion("viatico_vc").then(setFondo);
  }, [fondo]);

  const onChangePos = useCallback((id: string, next: Pos) => {
    setPos(p => ({ ...p, [id]: next }));
  }, []);
  const onTextChange = useCallback((id: string, texto: string) => {
    setOverrides(o => ({ ...o, [id]: texto }));
  }, []);

  async function guardarPosiciones() {
    setGuardando(true);
    await guardarPosicionesImpresion("viatico_vc", pos);
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  }
  function restablecerPosiciones() {
    setPos({ ...POS_DEFAULT });
  }

  const nombramientoTexto = nombramientos.map(n => n.numero).join(", ");
  const fechaTexto = nombramientos.map(n => fechaCorta(n.fecha)).join(", ");

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
        titulo={`Viático Constancia — Formulario ${numeroFormulario ?? ""}`}
        verPosiciones={verPosiciones} onToggleVer={() => setVerPosiciones(p => !p)}
        onRestablecer={restablecerPosiciones} onGuardar={guardarPosiciones}
        guardando={guardando} guardado={guardado}
      />

      <HojaConFondo hojaRef={hojaRef} fondo={fondo}>
        {campo("persona_nombre", personaNombre ?? "")}
        {campo("persona_cargo", personaCargo ?? "")}
        {campo("persona_nit", personaNit ?? "")}
        {campo("persona_no_empleado", personaNoEmpleado ?? "")}
        {campo("dependencia", dependencia)}
        {campo("nombramiento", nombramientoTexto, { style: { fontSize: "8.5pt" } })}
        {campo("fecha_nombramiento", fechaTexto, { style: { fontSize: "8.5pt" } })}
      </HojaConFondo>

      <style>{HOJA_CON_FONDO_CSS}</style>
      {verPosiciones && <style>{CAMPO_POSICIONABLE_CSS}</style>}
    </>
  );
}
