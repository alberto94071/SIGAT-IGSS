"use client";
import { OverlayPrint } from "@/components/overlay-print/OverlayPrint";
import OverlayField from "@/components/overlay-print/OverlayField";

// El cliente pidió que el V-C (Viático Constancia) solo lleve el encabezado
// (casillas 1-7: datos del trabajador, dependencia, nombramiento/fecha) — la
// tabla "Permaneció en comisión oficial..." (8-14, Llegada/Salida/Autoridad/
// Firma) se llena a mano en el lugar de destino, no la toca el sistema.
// Posiciones calibradas contra el PDF de referencia (612x792pt = 8.5x11in),
// no contra el papel físico real — igual que el resto de formularios
// pre-impresos, si al imprimir en el talonario quedan corridas hay que
// ajustar estos valores.
function fechaCorta(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function ImprimirVCClient({
  numeroFormulario, personaNombre, personaCargo, personaNit, personaNoEmpleado, dependencia, nombramientos,
}: {
  numeroFormulario: string | null; personaNombre: string | null; personaCargo: string | null;
  personaNit: string | null; personaNoEmpleado: string | null; dependencia: string;
  nombramientos: { numero: string; fecha: string }[];
}) {
  const nombramientoTexto = nombramientos.map(n => n.numero).join(", ");
  const fechaTexto = nombramientos.map(n => fechaCorta(n.fecha)).join(", ");

  return (
    <OverlayPrint storageKey="overlay-offset-viatico-vc" title={`Viático Constancia — Formulario ${numeroFormulario ?? ""}`}>
      <OverlayField top={2.82} left={1.05} width={6.25}>{personaNombre}</OverlayField>
      <OverlayField top={3.11} left={0.85} width={6.45}>{personaCargo}</OverlayField>
      <OverlayField top={3.40} left={0.75} width={3.2}>{personaNit}</OverlayField>
      <OverlayField top={3.40} left={5.95} width={1.35}>{personaNoEmpleado}</OverlayField>
      <OverlayField top={3.69} left={1.40} width={5.9}>{dependencia}</OverlayField>
      <OverlayField top={3.98} left={1.60} width={2.7} size={8.5}>{nombramientoTexto}</OverlayField>
      <OverlayField top={3.98} left={5.05} width={2.25} size={8.5}>{fechaTexto}</OverlayField>
    </OverlayPrint>
  );
}
