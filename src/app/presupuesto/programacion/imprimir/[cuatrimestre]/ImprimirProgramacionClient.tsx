"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import PrintPages from "@/components/print-pages/PrintPages";
import SelectorFirmante, { type Firmante } from "@/components/SelectorFirmante";
import { fechaGuatemala } from "@/lib/date-utils";
import type { ProgramacionEntrada } from "@/lib/programacion-actions";

interface Props {
  esReprogramacion: boolean;
  cuatrimestre: number;
  cuatrimestreLabel: string;
  entradas: ProgramacionEntrada[];
  nombreUnidad: string;
  firmantes: Firmante[];
}

const Q = (n: number) => n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FONT = "Arial, Helvetica, sans-serif";
const C = "#000";
const COLS = ["9%", "9%", "27%", "10%", "10%", "9.75%", "9.75%", "9.75%", "9.75%"];

function ColGroup() {
  return <colgroup>{COLS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>;
}

export default function ImprimirProgramacionClient({
  esReprogramacion, cuatrimestre, cuatrimestreLabel, entradas,
  nombreUnidad, firmantes,
}: Props) {
  const router = useRouter();
  const [paginas, setPaginas] = useState(1);
  const [firmante, setFirmante] = useState<Firmante | null>(null);
  const nombreEncargado = firmante?.nombre ?? "___________________________";
  const cargoEncargado = firmante?.cargo ?? "Encargado(a) de Unidad";
  const titulo = esReprogramacion ? "Reprogramación" : "Programación";

  const encabezado = (
    <div style={{ fontFamily: FONT, color: C }}>
      <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold" }}>INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL</p>
      <p style={{ margin: "1px 0 10px 0", fontSize: "8.5pt" }}>{nombreUnidad}</p>
      <h1 style={{ textAlign: "center", fontSize: "12pt", fontWeight: "bold", margin: "10px 0", textTransform: "uppercase" }}>
        Formato de {titulo} — Cuatrimestre {cuatrimestre}: {cuatrimestreLabel}
      </h1>
      <p style={{ textAlign: "right", fontSize: "8.5pt", margin: "0 0 8px 0" }}>Fecha de impresión: {fechaGuatemala()}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", tableLayout: "fixed" }}>
        <ColGroup />
        <thead>
          <tr>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Renglón</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Tipo</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Sub-Producto</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Normal/Reg.</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Estado</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Mes 1</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Mes 2</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Mes 3</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Mes 4</th>
          </tr>
        </thead>
      </table>
    </div>
  );

  const filaRow = (e: ProgramacionEntrada) => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup />
      <tbody>
        <tr>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{e.renglon}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "center" }} colSpan={2}>{e.descripcion} ({e.subProducto})</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "center", textTransform: "capitalize" }}>{e.tipo}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "center" }}>{e.estado}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>{Q(e.mes1)}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>{Q(e.mes2)}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>{Q(e.mes3)}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>{Q(e.mes4)}</td>
        </tr>
      </tbody>
    </table>
  );

  const totalGeneral = entradas.reduce((s, e) => s + e.total, 0);

  const cierre = (
    <div style={{ fontFamily: FONT, color: C }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", tableLayout: "fixed" }}>
        <ColGroup />
        <tfoot>
          <tr>
            <td colSpan={8} style={{ border: "1px solid #999", padding: "5px", textAlign: "right", fontWeight: "bold" }}>TOTAL {titulo.toUpperCase()}</td>
            <td style={{ border: "1px solid #999", padding: "5px", textAlign: "right", fontWeight: "bold", fontFamily: "monospace" }}>Q {Q(totalGeneral)}</td>
          </tr>
        </tfoot>
      </table>
      <div style={{ textAlign: "center", marginTop: "50px", fontSize: "9pt" }}>
        <div style={{ borderBottom: "1px solid #000", width: "260px", margin: "0 auto 4px auto", height: "30px" }} />
        <p style={{ margin: 0, fontWeight: "bold" }}>{nombreEncargado}</p>
        <p style={{ margin: 0, color: "#555" }}>{cargoEncargado}</p>
      </div>
    </div>
  );

  const sections: React.ReactNode[] = entradas.length > 0
    ? [...entradas.map(e => filaRow(e)), cierre]
    : [
        <p key="vacio" style={{ fontFamily: FONT, color: C, fontSize: "9pt", textAlign: "center", padding: "20px" }}>
          No hay entradas registradas en este cuatrimestre.
        </p>,
        cierre,
      ];

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">
          {titulo} C{cuatrimestre} · {paginas} {paginas === 1 ? "hoja" : "hojas"} tamaño Carta
        </span>
        <span className="text-gray-300">|</span>
        <SelectorFirmante label="Encargado(a)" firmantes={firmantes} value={firmante} onChange={setFirmante} />
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <PrintPages sections={sections} headerSections={[encabezado]} pageSize="letter" marginMm={12} onPageCount={setPaginas} />
    </>
  );
}
