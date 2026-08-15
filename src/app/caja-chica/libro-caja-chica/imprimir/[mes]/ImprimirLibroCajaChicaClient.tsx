"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import PrintPages from "@/components/print-pages/PrintPages";
import { fechaGuatemala } from "@/lib/date-utils";
import type { LibroCajaChicaRow } from "@/lib/caja-chica-liquidacion-actions";

interface Props { mes: string; filas: LibroCajaChicaRow[]; nombreUnidad: string; municipio: string; }

const Q = (n: number) => n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FONT = "Arial, Helvetica, sans-serif";
const C = "#000";
const COLS = ["10%", "12%", "24%", "28%", "12%", "14%"];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function ColGroup() {
  return <colgroup>{COLS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>;
}

export default function ImprimirLibroCajaChicaClient({ mes, filas, nombreUnidad, municipio }: Props) {
  const router = useRouter();
  const [paginas, setPaginas] = useState(1);
  const [anio, mesNum] = mes.split("-").map(Number);
  const nombreMes = MESES[(mesNum ?? 1) - 1] ?? mes;
  const total = filas.reduce((s, f) => s + (f.total ?? 0), 0);

  const encabezado = (
    <div style={{ fontFamily: FONT, color: C }}>
      <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold" }}>INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL</p>
      <p style={{ margin: "1px 0 10px 0", fontSize: "8.5pt" }}>{nombreUnidad}</p>
      <h1 style={{ textAlign: "center", fontSize: "12pt", fontWeight: "bold", margin: "10px 0", textTransform: "uppercase" }}>
        Libro Caja Chica — {nombreMes} {anio}
      </h1>
      <p style={{ textAlign: "right", fontSize: "8.5pt", margin: "0 0 8px 0" }}>{municipio}, fecha de impresión: {fechaGuatemala()}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", tableLayout: "fixed" }}>
        <ColGroup />
        <thead>
          <tr>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Origen</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Fecha de pago</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Destinatario</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Factura / Detalle</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>No. Vale</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Total</th>
          </tr>
        </thead>
      </table>
    </div>
  );

  const fila = (f: LibroCajaChicaRow) => (
    <table key={f.id} style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup />
      <tbody>
        <tr>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{f.origen}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{f.fecha_pago ?? "—"}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{f.destinatario_nombre ?? "—"}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{f.factura ?? f.detalle ?? "—"}</td>
          <td style={{ border: "1px solid #999", padding: "3px", fontFamily: "monospace" }}>{f.numero_vale ?? "—"}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>{f.total != null ? `Q${Q(f.total)}` : "—"}</td>
        </tr>
      </tbody>
    </table>
  );

  const totales = (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup />
      <tbody>
        <tr>
          <td colSpan={5} style={{ border: "1px solid #999", padding: "4px 3px", fontWeight: "bold", background: "#f1f5f9" }}>TOTAL DEL MES</td>
          <td style={{ border: "1px solid #999", padding: "4px 3px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>Q{Q(total)}</td>
        </tr>
      </tbody>
    </table>
  );

  const sections: React.ReactNode[] = [
    ...(filas.length > 0
      ? filas.map(f => fila(f))
      : [<p key="sin-mov" style={{ fontFamily: FONT, color: C, fontSize: "8.5pt", padding: "6px 0" }}>Sin movimientos este mes.</p>]),
    totales,
  ];

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">
          Libro Caja Chica — {nombreMes} {anio} · {paginas} {paginas === 1 ? "hoja" : "hojas"} tamaño Carta
        </span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <PrintPages sections={sections} headerSections={[encabezado]} pageSize="letter" landscape marginMm={12} onPageCount={setPaginas} />
    </>
  );
}
