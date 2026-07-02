"use client";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";

interface Props { anio: number; contenido: string; nombreUnidad: string; }

export default function ImprimirActaClient({ anio, contenido, nombreUnidad }: Props) {
  const router = useRouter();

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">Acta de Negociación {anio}</span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div id="print-wrapper">
        <div id="a4-sheet">
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <p style={{ fontWeight: "bold", fontSize: "13pt", margin: 0 }}>ACTA DE NEGOCIACIÓN</p>
            <p style={{ fontSize: "10pt", margin: "4px 0 0 0", color: "#444" }}>{nombreUnidad}</p>
            <p style={{ fontSize: "10pt", margin: "2px 0 0 0", color: "#444" }}>Año {anio}</p>
          </div>
          <div style={{ fontSize: "10.5pt", lineHeight: 1.6, whiteSpace: "pre-wrap", textAlign: "justify" }}>
            {contenido || "Sin contenido registrado para este año."}
          </div>
        </div>
      </div>

      <style>{`
        #print-wrapper {
          background: #94a3b8; display: flex; justify-content: center; align-items: flex-start;
          padding: 40px 20px; min-height: 100vh; margin-top: 52px; box-sizing: border-box;
        }
        #a4-sheet {
          background: white; width: 210mm; min-height: 297mm; box-shadow: 0 4px 32px rgba(0,0,0,0.22);
          padding: 20mm 18mm; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; color: #000;
        }
        .no-print { display: block; }
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          .no-print { display: none !important; }
          #print-wrapper { background: white !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; display: block !important; }
          #a4-sheet { width: 100% !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
        }
      `}</style>
    </>
  );
}
