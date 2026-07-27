"use client";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import type { Fri, PolizaFri } from "@/lib/fri-actions";
import type { PagoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";

interface Props {
  fri: Fri;
  pagos: PagoFondoRotativo[];
  polizas: PolizaFri[];
  nombreUnidad: string;
  nombreEncargado: string; cargoEncargado: string;
}

const Q = (n: number) => n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Fila = { key: string; origen: string; referencia: string; detalle: string; total: number };
function filasDe(pagos: PagoFondoRotativo[], polizas: PolizaFri[]): Fila[] {
  return [
    ...pagos.map(p => ({
      key: `pago:${p.id}`, origen: "Gastos Varios",
      referencia: p.numero_a04 != null ? `A-04 ${p.numero_a04}/${p.anio_a04}` : "—",
      detalle: `${p.destinatario_nombre ?? "—"} · ${p.forma_pago === "cheque" ? `Cheque ${p.numero_cheque ?? ""}` : `Vale ${p.numero_vale ?? ""}`} · Factura ${p.serie_factura}-${p.no_factura}`,
      total: p.total ?? 0,
    })),
    ...polizas.map(p => ({
      key: `poliza:${p.id}`, origen: "Pasajes",
      referencia: `Póliza ${p.numero}`,
      detalle: `Cuadro de Caja del ${p.fecha}`,
      total: p.total,
    })),
  ];
}

const FONT = "Arial, Helvetica, sans-serif";
const C = "#000";

export default function ImprimirFriClient({ fri, pagos, polizas, nombreUnidad, nombreEncargado, cargoEncargado }: Props) {
  const router = useRouter();
  const filas = filasDe(pagos, polizas);

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">FRI {fri.numero}/{fri.anio}</span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div id="print-wrapper">
        <div id="a4-sheet" style={{ fontFamily: FONT, color: C, padding: "16px" }}>

          <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold" }}>INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL</p>
          <p style={{ margin: "1px 0 10px 0", fontSize: "8.5pt" }}>{nombreUnidad}</p>

          <h1 style={{ textAlign: "center", fontSize: "12pt", fontWeight: "bold", margin: "10px 0", textTransform: "uppercase" }}>
            Formulario de Reintegro Interno — FRI {fri.numero}/{fri.anio}
          </h1>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", marginBottom: "12px" }}>
            <span>Estado: <strong>{fri.estado}</strong></span>
            {fri.fecha_reintegro && <span>Fecha de reintegro: <strong>{fri.fecha_reintegro}</strong></span>}
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>Origen</th>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>Referencia</th>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>Detalle</th>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>Valor Q.</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f => (
                <tr key={f.key}>
                  <td style={{ border: "1px solid #999", padding: "4px 6px" }}>{f.origen}</td>
                  <td style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "center" }}>{f.referencia}</td>
                  <td style={{ border: "1px solid #999", padding: "4px 6px" }}>{f.detalle}</td>
                  <td style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "right", fontFamily: "monospace" }}>
                    Q {Q(f.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "right", fontWeight: "bold" }}>TOTAL A REINTEGRAR</td>
                <td style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "right", fontWeight: "bold", fontFamily: "monospace" }}>Q {Q(fri.total)}</td>
              </tr>
            </tfoot>
          </table>

          <div style={{ textAlign: "center", marginTop: "50px", fontSize: "9pt" }}>
            <div style={{ borderBottom: "1px solid #000", width: "260px", margin: "0 auto 4px auto", height: "30px" }} />
            <p style={{ margin: 0, fontWeight: "bold" }}>{nombreEncargado}</p>
            <p style={{ margin: 0, color: "#555" }}>{cargoEncargado}</p>
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
          box-sizing: border-box;
        }
        .no-print { display: block; }
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .no-print { display: none !important; }
          #print-wrapper { background: white !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; display: block !important; }
          #a4-sheet { width: 100% !important; min-height: 0 !important; box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>
    </>
  );
}
