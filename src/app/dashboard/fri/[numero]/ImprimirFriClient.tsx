"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import PrintPages from "@/components/print-pages/PrintPages";
import type { Fri, FriGrupoRenglon } from "@/lib/fri-actions";

type SaldoFondoRotativo = { monto_fondo_rotativo: number; saldo_disponible: number; efectivo_en_caja: number };

interface Props {
  fri: Fri;
  grupos: FriGrupoRenglon[];
  saldo: SaldoFondoRotativo;
  nombreUnidad: string;
  nombreEncargado: string; cargoEncargado: string;
}

const Q = (n: number) => n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FONT = "Arial, Helvetica, sans-serif";
const C = "#000";
const COLS = ["16%", "48%", "18%", "18%"];

function ColGroup() {
  return <colgroup>{COLS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>;
}

export default function ImprimirFriClient({ fri, grupos, saldo, nombreUnidad, nombreEncargado, cargoEncargado }: Props) {
  const router = useRouter();
  const [paginas, setPaginas] = useState(1);
  const totalSinIva = grupos.reduce((s, g) => s + g.subtotal, 0);

  const encabezado = (
    <div style={{ fontFamily: FONT, color: C }}>
      <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold" }}>INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL</p>
      <p style={{ margin: "1px 0 10px 0", fontSize: "8.5pt" }}>{nombreUnidad}</p>
      <h1 style={{ textAlign: "center", fontSize: "12pt", fontWeight: "bold", margin: "10px 0", textTransform: "uppercase" }}>
        Formulario de Reintegro Interno — FRI {fri.numero}/{fri.anio}
      </h1>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", marginBottom: "12px" }}>
        <span>Estado: <strong>{fri.estado}</strong></span>
        {fri.fecha_reintegro && <span>Fecha de reintegro: <strong>{fri.fecha_reintegro}</strong></span>}
      </div>
      <p style={{ fontSize: "9.5pt", fontWeight: "bold", margin: "0 0 4px 0" }}>Resumen por renglón presupuestario (montos sin IVA)</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", tableLayout: "fixed" }}>
        <ColGroup />
        <thead>
          <tr>
            <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>Referencia</th>
            <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>Detalle</th>
            <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>Renglón</th>
            <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>Valor Q. (sin IVA)</th>
          </tr>
        </thead>
      </table>
    </div>
  );

  const tituloRenglon = (g: FriGrupoRenglon) => (
    <p style={{ fontFamily: FONT, color: C, fontSize: "8.5pt", fontWeight: "bold", margin: "8px 0 2px 0" }}>
      RENGLÓN {g.renglon}
    </p>
  );

  const filaDoc = (g: FriGrupoRenglon, docIdx: number) => {
    const d = g.documentos[docIdx];
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", tableLayout: "fixed", fontFamily: FONT, color: C }}>
        <ColGroup />
        <tbody>
          <tr>
            <td style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "center" }}>{d.referencia}</td>
            <td style={{ border: "1px solid #999", padding: "4px 6px" }}>{d.detalle}</td>
            <td style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "center" }}>{g.renglon}</td>
            <td style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "right", fontFamily: "monospace" }}>Q {Q(d.monto)}</td>
          </tr>
        </tbody>
      </table>
    );
  };

  const subtotalRenglon = (g: FriGrupoRenglon) => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup />
      <tbody>
        <tr>
          <td colSpan={3} style={{ border: "1px solid #999", padding: "3px 6px", textAlign: "right", fontStyle: "italic", background: "#f8fafc" }}>
            Subtotal renglón {g.renglon}
          </td>
          <td style={{ border: "1px solid #999", padding: "3px 6px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold", background: "#f8fafc" }}>
            Q {Q(g.subtotal)}
          </td>
        </tr>
      </tbody>
    </table>
  );

  const totalDelFondo = (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup />
      <tfoot>
        <tr>
          <td colSpan={3} style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "right", fontWeight: "bold" }}>TOTAL DEL FONDO (sin IVA)</td>
          <td style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "right", fontWeight: "bold", fontFamily: "monospace" }}>Q {Q(totalSinIva)}</td>
        </tr>
      </tfoot>
    </table>
  );

  const cierre = (
    <div style={{ fontFamily: FONT, color: C }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", tableLayout: "fixed" }}>
        <ColGroup />
        <tfoot>
          <tr>
            <td colSpan={3} style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "right", fontWeight: "bold" }}>TOTAL A REINTEGRAR</td>
            <td style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "right", fontWeight: "bold", fontFamily: "monospace" }}>Q {Q(fri.total)}</td>
          </tr>
        </tfoot>
      </table>

      <p style={{ fontSize: "9.5pt", fontWeight: "bold", margin: "16px 0 6px 0" }}>Arqueo del Fondo Rotativo Interno</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", tableLayout: "fixed" }}>
        <colgroup><col style={{ width: "60%" }} /><col style={{ width: "40%" }} /></colgroup>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #999", padding: "5px 6px" }}>Monto del Fondo Rotativo otorgado</td>
            <td style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "right", fontFamily: "monospace" }}>Q {Q(saldo.monto_fondo_rotativo)}</td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #999", padding: "5px 6px" }}>Disponibilidad (saldo del Fondo Rotativo)</td>
            <td style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "right", fontFamily: "monospace" }}>Q {Q(saldo.saldo_disponible)}</td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #999", padding: "5px 6px" }}>Efectivo/vales activos en Caja Chica</td>
            <td style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "right", fontFamily: "monospace" }}>Q {Q(saldo.efectivo_en_caja)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: "center", marginTop: "50px", fontSize: "9pt" }}>
        <div style={{ borderBottom: "1px solid #000", width: "260px", margin: "0 auto 4px auto", height: "30px" }} />
        <p style={{ margin: 0, fontWeight: "bold" }}>{nombreEncargado}</p>
        <p style={{ margin: 0, color: "#555" }}>{cargoEncargado}</p>
      </div>
    </div>
  );

  const sections: React.ReactNode[] = [
    ...grupos.flatMap((g, gi) => [
      <div key={`renglon-${gi}`}>{tituloRenglon(g)}</div>,
      ...g.documentos.map((_, di) => <div key={`renglon-${gi}-doc-${di}`}>{filaDoc(g, di)}</div>),
      <div key={`renglon-${gi}-subtotal`}>{subtotalRenglon(g)}</div>,
    ]),
    <div key="total-fondo">{totalDelFondo}</div>,
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
          FRI {fri.numero}/{fri.anio} · {paginas} {paginas === 1 ? "hoja" : "hojas"} tamaño A4
        </span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <PrintPages sections={sections} headerSections={[encabezado]} pageSize="a4" marginMm={10} onPageCount={setPaginas} />
    </>
  );
}
