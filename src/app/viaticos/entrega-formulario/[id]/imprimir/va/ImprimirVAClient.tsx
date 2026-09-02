"use client";
import { OverlayPrint } from "@/components/overlay-print/OverlayPrint";
import OverlayField from "@/components/overlay-print/OverlayField";

// El V-A (Viático Anticipo) de esta unidad nunca se usa de verdad — el
// cliente pidió que siempre se imprima "NO UTILIZADO" en el cuadro de Tipo
// de Comisión/Lugares, sin depender de ningún dato de la solicitud.
export default function ImprimirVAClient({ numeroFormulario }: { numeroFormulario: string | null }) {
  return (
    <OverlayPrint storageKey="overlay-offset-viatico-va" title={`Viático Anticipo — Formulario ${numeroFormulario ?? ""}`}>
      <OverlayField top={2.55} left={1.2} width={3.0} bold size={13}>NO UTILIZADO</OverlayField>
    </OverlayPrint>
  );
}
