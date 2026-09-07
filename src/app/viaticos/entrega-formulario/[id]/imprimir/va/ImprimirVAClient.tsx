"use client";
import { useState, useCallback, useRef, useLayoutEffect } from "react";
import { guardarPosicionesImpresion, getFondoImpresion } from "@/lib/impresion-posiciones-actions";
import { Campo, CAMPO_POSICIONABLE_CSS, type Pos } from "@/components/print-posiciones/CampoPosicionable";
import { PosicionesToolbar, HojaConFondo, HOJA_CON_FONDO_CSS } from "@/components/print-posiciones/PosicionesToolbar";

const HOJA_W_MM = 215.9;
const HOJA_H_MM = 279.4;
const IN = 25.4;

// El V-A (Viático Anticipo) de esta unidad nunca se usa de verdad — el
// cliente pidió que siempre se imprima "NO UTILIZADO" en el cuadro de Tipo
// de Comisión/Lugares, sin depender de ningún dato de la solicitud.
const POS_DEFAULT: Record<string, Pos> = {
  no_utilizado: { top: 2.55 * IN, left: 1.2 * IN },
};

interface Props {
  numeroFormulario: string | null;
  posicionesGuardadas: Record<string, Pos>;
}

export default function ImprimirVAClient({ numeroFormulario, posicionesGuardadas }: Props) {
  const [verPosiciones, setVerPosiciones] = useState(false);
  const [pos, setPos] = useState<Record<string, Pos>>({ ...POS_DEFAULT, ...posicionesGuardadas });
  const [fondo, setFondo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const hojaRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!fondo) getFondoImpresion("viatico_va").then(setFondo);
  }, [fondo]);

  const onChangePos = useCallback((id: string, next: Pos) => {
    setPos(p => ({ ...p, [id]: next }));
  }, []);

  async function guardarPosiciones() {
    setGuardando(true);
    await guardarPosicionesImpresion("viatico_va", pos);
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  }
  function restablecerPosiciones() {
    setPos({ ...POS_DEFAULT });
  }

  return (
    <>
      <PosicionesToolbar
        titulo={`Viático Anticipo — Formulario ${numeroFormulario ?? ""}`}
        verPosiciones={verPosiciones} onToggleVer={() => setVerPosiciones(p => !p)}
        onRestablecer={restablecerPosiciones} onGuardar={guardarPosiciones}
        guardando={guardando} guardado={guardado}
      />

      <HojaConFondo hojaRef={hojaRef} fondo={fondo}>
        <Campo
          id="no_utilizado" texto="NO UTILIZADO" hojaRef={hojaRef} hojaWMm={HOJA_W_MM} hojaHMm={HOJA_H_MM}
          pos={pos.no_utilizado ?? POS_DEFAULT.no_utilizado} onChange={onChangePos}
          editable={verPosiciones} label="NO UTILIZADO"
          style={{ fontWeight: 700, fontSize: "13pt" }}
        />
      </HojaConFondo>

      <style>{HOJA_CON_FONDO_CSS}</style>
      {verPosiciones && <style>{CAMPO_POSICIONABLE_CSS}</style>}
    </>
  );
}
