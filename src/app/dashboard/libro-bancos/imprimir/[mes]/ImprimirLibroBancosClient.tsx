"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import PrintPages from "@/components/print-pages/PrintPages";
import { fechaGuatemala } from "@/lib/date-utils";
import type { MovimientoBanco } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";

interface Props {
  mes: string; movimientos: MovimientoBanco[]; saldoAnterior: number;
  nombreUnidad: string; municipio: string;
}

const Q = (n: number) => n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FONT = "Arial, Helvetica, sans-serif";
const C = "#000";
const COLS = ["10%", "10%", "12%", "36%", "12%", "10%", "10%"];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function ColGroup() {
  return <colgroup>{COLS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>;
}

export default function ImprimirLibroBancosClient({ mes, movimientos, saldoAnterior, nombreUnidad, municipio }: Props) {
  const router = useRouter();
  const [paginas, setPaginas] = useState(1);
  const [anio, mesNum] = mes.split("-").map(Number);
  const nombreMes = MESES[(mesNum ?? 1) - 1] ?? mes;

  const totalDebe = movimientos.reduce((s, m) => s + m.debe, 0);
  const totalHaber = movimientos.reduce((s, m) => s + m.haber, 0);
  const saldoFinal = movimientos.length > 0 ? movimientos[movimientos.length - 1].saldo : saldoAnterior;

  const encabezado = (
    <div style={{ fontFamily: FONT, color: C }}>
      <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold" }}>INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL</p>
      <p style={{ margin: "1px 0 10px 0", fontSize: "8.5pt" }}>{nombreUnidad}</p>
      <h1 style={{ textAlign: "center", fontSize: "12pt", fontWeight: "bold", margin: "10px 0", textTransform: "uppercase" }}>
        Libro Bancos — {nombreMes} {anio}
      </h1>
      <p style={{ textAlign: "right", fontSize: "8.5pt", margin: "0 0 8px 0" }}>{municipio}, fecha de impresión: {fechaGuatemala()}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", tableLayout: "fixed" }}>
        <ColGroup />
        <thead>
          <tr>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Fecha</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Tipo</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>No. Cheque</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Beneficiario / Concepto</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Debe</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Haber</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Saldo</th>
          </tr>
        </thead>
      </table>
    </div>
  );

  const filaSaldoAnterior = (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup />
      <tbody>
        <tr>
          <td colSpan={6} style={{ border: "1px solid #999", padding: "3px", fontStyle: "italic", color: "#555" }}>Saldo anterior</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>Q{Q(saldoAnterior)}</td>
        </tr>
      </tbody>
    </table>
  );

  const fila = (m: MovimientoBanco) => (
    <table key={m.id} style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup />
      <tbody>
        <tr>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{m.fecha}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{m.tipo}</td>
          <td style={{ border: "1px solid #999", padding: "3px", fontFamily: "monospace" }}>{m.numero_cheque ?? "—"}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>
            {m.beneficiario ?? "—"}<br /><span style={{ color: "#666" }}>{m.descripcion}</span>
          </td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>{m.debe > 0 ? `Q${Q(m.debe)}` : ""}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>{m.haber > 0 ? `Q${Q(m.haber)}` : ""}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>Q{Q(m.saldo)}</td>
        </tr>
      </tbody>
    </table>
  );

  const totales = (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup />
      <tbody>
        <tr>
          <td colSpan={4} style={{ border: "1px solid #999", padding: "4px 3px", fontWeight: "bold", background: "#f1f5f9" }}>TOTALES DEL MES</td>
          <td style={{ border: "1px solid #999", padding: "4px 3px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>Q{Q(totalDebe)}</td>
          <td style={{ border: "1px solid #999", padding: "4px 3px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>Q{Q(totalHaber)}</td>
          <td style={{ border: "1px solid #999", padding: "4px 3px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>Q{Q(saldoFinal)}</td>
        </tr>
      </tbody>
    </table>
  );

  const sections: React.ReactNode[] = [
    filaSaldoAnterior,
    ...(movimientos.length > 0
      ? movimientos.map(m => fila(m))
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
          Libro Bancos — {nombreMes} {anio} · {paginas} {paginas === 1 ? "hoja" : "hojas"} tamaño Carta
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
