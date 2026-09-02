"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

// Documento narrativo libre (Informe de Comisión / Justificación de
// Estancia) — a diferencia de los formularios pre-impresos (V-A/V-C/V-L),
// este SÍ dibuja su propia hoja membretada, porque no existe un talonario
// físico detrás: es un documento que la unidad genera de cero.
export default function ImprimirNarrativoClient({
  titulo, nombreUnidad, destinatarioNombre, destinatarioCargo,
  personaNombre, personaCargo, personaNoEmpleado, lugarYFecha, texto,
}: {
  titulo: string; nombreUnidad: string; destinatarioNombre: string; destinatarioCargo: string;
  personaNombre: string | null; personaCargo: string | null; personaNoEmpleado: string | null;
  lugarYFecha: string; texto: string | null;
}) {
  const router = useRouter();

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">{titulo}</span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div id="narrativo-wrapper">
        <div id="narrativo-page">
          <div className="text-center mb-8">
            <p className="font-bold text-sm">INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL</p>
            <p className="text-sm">{nombreUnidad}</p>
            <p className="font-bold text-base mt-4 uppercase">{titulo}</p>
          </div>

          {destinatarioNombre && (
            <div className="mb-6 text-sm">
              <p>Licenciado(a):</p>
              <p className="font-semibold">{destinatarioNombre}</p>
              <p>{destinatarioCargo}</p>
            </div>
          )}

          <div className="mb-6 text-sm">
            <p className="font-semibold">Datos del comisionado</p>
            <p>Nombre: {personaNombre}</p>
            <p>Cargo: {personaCargo}</p>
            <p>No. de Empleado: {personaNoEmpleado}</p>
          </div>

          <p className="text-sm leading-relaxed whitespace-pre-wrap min-h-[3in]">{texto || "—"}</p>

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
