"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import PrintPages from "@/components/print-pages/PrintPages";
import { fechaGuatemala } from "@/lib/date-utils";
import type { FilaReporteA01Siaf } from "@/lib/reportes/compras-actions";

const FONT = "Arial, Helvetica, sans-serif";
const C = "#000";
const AZUL_TITULO = "#1F4E79";
const VERDE_HEADER = "#4A5A2A";
const COLS = ["7%", "7%", "8%", "20%", "9%", "6%", "10%", "6%", "18%", "9%"];
const HEADERS = ["No. SIAF", "Fecha", "Estado", "Insumo", "Subproducto", "Renglón", "PPR / Código", "Cantidad", "Características PPR", "Presentación"];

function ColGroup() {
  return <colgroup>{COLS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>;
}

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

interface Props { filas: FilaReporteA01Siaf[]; }

export default function ImprimirReporteA01SiafClient({ filas }: Props) {
  const router = useRouter();
  const [paginas, setPaginas] = useState(1);

  const encabezado = (
    <div style={{ fontFamily: FONT, color: C }}>
      <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold" }}>INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL</p>
      <p style={{ margin: "1px 0 8px 0", fontSize: "8.5pt" }}>Control Interno Presupuestario — Reportes</p>
      <p style={{ textAlign: "right", fontSize: "8pt", margin: "0 0 6px 0" }}>Fecha de impresión: {fechaGuatemala()}</p>
      <div style={{ background: AZUL_TITULO, color: "#fff", padding: "5px 8px", fontWeight: "bold", fontSize: "9pt", textAlign: "center" }}>
        Reporte de Compras — A-01 SIAF (todos los insumos, todos los años)
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "7.5pt", tableLayout: "fixed", marginTop: "4px" }}>
        <ColGroup />
        <thead>
          <tr>
            {HEADERS.map(h => (
              <th key={h} style={{ border: "1px solid #999", padding: "4px 3px", background: VERDE_HEADER, color: "#fff" }}>{h}</th>
            ))}
          </tr>
        </thead>
      </table>
    </div>
  );

  const fila = (f: FilaReporteA01Siaf) => (
    <table key={f.item_id} style={{ width: "100%", borderCollapse: "collapse", fontSize: "7pt", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup />
      <tbody>
        <tr>
          <td style={{ border: "1px solid #999", padding: "3px", fontWeight: "bold" }}>{f.siaf_numero}/{f.siaf_anio}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{fechaCorta(f.siaf_fecha)}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{f.siaf_estado}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{f.insumo}</td>
          <td style={{ border: "1px solid #999", padding: "3px", fontFamily: "monospace" }}>{f.subproducto}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "center" }}>{f.renglon ?? "—"}</td>
          <td style={{ border: "1px solid #999", padding: "3px", fontFamily: "monospace" }}>{f.codigo_o_ppr}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>{f.cantidad.toLocaleString("es-GT")}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{f.caracteristicas ?? "—"}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{f.presentacion ?? "—"}</td>
        </tr>
      </tbody>
    </table>
  );

  const sections: React.ReactNode[] = filas.length > 0
    ? filas.map(f => fila(f))
    : [<p key="sin-filas" style={{ fontFamily: FONT, color: C, fontSize: "8.5pt", padding: "6px 0" }}>Sin solicitudes A-01 SIAF registradas.</p>];

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">
          Reporte A-01 SIAF — {filas.length.toLocaleString("es-GT")} insumos · {paginas} {paginas === 1 ? "hoja" : "hojas"} tamaño Carta
        </span>
        <span className="text-xs text-gray-400">Usá "Guardar como PDF" en el diálogo de impresión del navegador para descargarlo en ese formato.</span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <PrintPages sections={sections} headerSections={[encabezado]} pageSize="letter" landscape marginMm={12} onPageCount={setPaginas} />
    </>
  );
}
