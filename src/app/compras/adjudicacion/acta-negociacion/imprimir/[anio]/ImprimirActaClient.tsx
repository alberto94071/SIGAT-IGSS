"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import PrintPages from "@/components/print-pages/PrintPages";

interface Props { anio: number; contenido: string; nombreUnidad: string; }

export default function ImprimirActaClient({ anio, contenido, nombreUnidad }: Props) {
  const router = useRouter();
  const [paginas, setPaginas] = useState(1);

  const encabezado = (
    <div style={{ textAlign: "center", marginBottom: "20px" }}>
      <p style={{ fontWeight: "bold", fontSize: "13pt", margin: 0 }}>ACTA DE NEGOCIACIÓN</p>
      <p style={{ fontSize: "10pt", margin: "4px 0 0 0", color: "#444" }}>{nombreUnidad}</p>
      <p style={{ fontSize: "10pt", margin: "2px 0 0 0", color: "#444" }}>Año {anio}</p>
    </div>
  );

  // Se parte por párrafo para poder acomodar el contenido en varias hojas
  // sin cortar un párrafo a la mitad, en vez de una sola caja que crece sin
  // límite.
  const parrafos = (contenido || "Sin contenido registrado para este año.").split(/\n{2,}/);
  const sections: React.ReactNode[] = [
    <>{encabezado}{parrafos.length > 0 && (
      <p style={{ fontSize: "10.5pt", lineHeight: 1.6, whiteSpace: "pre-wrap", textAlign: "justify", margin: 0 }}>{parrafos[0]}</p>
    )}</>,
    ...parrafos.slice(1).map((p, i) => (
      <p key={i} style={{ fontSize: "10.5pt", lineHeight: 1.6, whiteSpace: "pre-wrap", textAlign: "justify", margin: "10px 0 0 0" }}>{p}</p>
    )),
  ];

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">
          Acta de Negociación {anio} · {paginas} {paginas === 1 ? "hoja" : "hojas"} tamaño A4
        </span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <PrintPages sections={sections} pageSize="a4" marginMm={15} onPageCount={setPaginas} />
    </>
  );
}
