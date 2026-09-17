"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import SelectorFirmante, { type Firmante } from "@/components/SelectorFirmante";

// Documento narrativo libre (Informe de Comisión / Justificación de
// Estancia) — a diferencia de los formularios pre-impresos (V-A/V-C/V-L),
// este SÍ dibuja su propia hoja membretada, porque no existe un talonario
// físico detrás: es un documento que la unidad genera de cero.
export default function ImprimirNarrativoClient({
  titulo, nombreUnidad, destinatarioNombre, destinatarioCargo,
  personaNombre, personaCargo, personaNoEmpleado, lugarYFecha, texto,
  firmantesDirigidoA,
}: {
  titulo: string; nombreUnidad: string; destinatarioNombre: string; destinatarioCargo: string;
  personaNombre: string | null; personaCargo: string | null; personaNoEmpleado: string | null;
  lugarYFecha: string; texto: string | null;
  // Cuando viene con datos, agrega un selector "Dirigido a" en la barra de
  // impresión (mismo patrón "se elige al imprimir, no persiste" que el
  // resto del sistema) — la elección reemplaza destinatarioNombre/Cargo. Si
  // no se elige nada, se imprime el destinatario que ya venía resuelto por
  // el servidor (o nada, si tampoco había).
  firmantesDirigidoA?: Firmante[];
}) {
  const router = useRouter();
  const [firmanteElegido, setFirmanteElegido] = useState<Firmante | null>(null);
  const nombreFinal = firmanteElegido?.nombre ?? destinatarioNombre;
  const cargoFinal = firmanteElegido?.cargo ?? destinatarioCargo;

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">{titulo}</span>
        {firmantesDirigidoA && firmantesDirigidoA.length > 0 && (
          <>
            <span className="text-gray-300">|</span>
            <SelectorFirmante label="Dirigido a" firmantes={firmantesDirigidoA} value={firmanteElegido} onChange={setFirmanteElegido} />
          </>
        )}
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div id="narrativo-wrapper">
        <div id="narrativo-page">
          <div className="text-center mb-8">
            <img src="/LOGO_SIAF01.svg" alt="" style={{ height: "60px", margin: "0 auto 8px auto" }} />
            <p className="font-bold text-sm">INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL</p>
            <p className="text-sm">{nombreUnidad}</p>
            <p className="font-bold text-base mt-4 uppercase">{titulo}</p>
          </div>

          {nombreFinal && (
            <div className="mb-6 text-sm">
              <p className="font-semibold">{nombreFinal}</p>
              <p>{cargoFinal}</p>
            </div>
          )}

          <div className="mb-6 text-sm">
            <p className="font-semibold">Datos del comisionado</p>
            <p>Nombre: {personaNombre}</p>
            <p>Cargo: {personaCargo}</p>
            <p>No. de Empleado: {personaNoEmpleado}</p>
          </div>

          <p className="text-sm leading-relaxed whitespace-pre-wrap min-h-[3in]" style={{ textAlign: "justify" }}>{texto || "—"}</p>

          <div className="mt-16 text-center text-sm">
            <p>{lugarYFecha}</p>
            <p className="mt-10 border-t border-gray-800 inline-block px-8 pt-1">{personaNombre}</p>
            <p>{personaCargo}</p>
          </div>
        </div>
      </div>

      <style>{`
        #narrativo-wrapper {
          background: #94a3b8; display: flex; justify-content: center;
          padding: 40px 20px; min-height: 100vh; margin-top: 68px; box-sizing: border-box;
        }
        #narrativo-page {
          width: 8.5in; min-height: 11in; background: white; box-shadow: 0 4px 32px rgba(0,0,0,0.22);
          box-sizing: border-box; padding: 0.9in; flex-shrink: 0;
        }
        .no-print { display: block; }
        @media print {
          @page { size: letter; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          #narrativo-wrapper { background: white !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; }
          #narrativo-page { box-shadow: none !important; }
        }
      `}</style>
    </>
  );
}
