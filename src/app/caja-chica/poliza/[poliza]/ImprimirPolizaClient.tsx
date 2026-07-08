"use client";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";

type Pago = {
  formulario_no: number; fecha_pago: string; afiliacion: string; nombre_afiliado: string;
  valor_pasaje: number; observaciones: string | null;
};

interface Props {
  polizaNo: number;
  pagos: Pago[];
  codigoUnidad: string;
  nombreUnidad: string;
}

const Q = (n: number) => n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

const FONT = "Arial, Helvetica, sans-serif";
const B = "1.5px solid #1a1a1a";
const C = "#000";

export default function ImprimirPolizaClient({ polizaNo, pagos, codigoUnidad, nombreUnidad }: Props) {
  const router = useRouter();
  const fechas = pagos.map(p => p.fecha_pago).sort();
  const desde = fechas[0];
  const hasta = fechas[fechas.length - 1];
  const total = pagos.reduce((s, p) => s + p.valor_pasaje, 0);
  const anio = desde ? desde.slice(0, 4) : String(new Date().getFullYear());

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">Póliza No. {polizaNo}</span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div id="print-wrapper">
        <div id="a4-sheet" style={{ fontFamily: FONT, color: C, border: B, borderRadius: "8px", padding: "18px" }}>

          <div style={{ textAlign: "center", marginBottom: "10px" }}>
            <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold" }}>INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "9pt" }}>Depto. De Auditoria Interna</p>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", marginBottom: "10px" }}>
            <span>Póliza No.: <strong>{polizaNo}-{anio}-{codigoUnidad}</strong></span>
            <span>Cuadro de Caja No.: <strong>{polizaNo}</strong></span>
          </div>

          <p style={{ margin: "0 0 4px 0", fontSize: "9.5pt" }}>
            Pasajes Pagados de la Caja: <strong>{nombreUnidad}.</strong>
          </p>
          <p style={{ margin: "0 0 14px 0", fontSize: "9.5pt" }}>
            Durante la semana comprendida del: <strong>{desde && fechaLarga(desde)}</strong> al <strong>{hasta && fechaLarga(hasta)}</strong>
          </p>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>No. COMP</th>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>NOMBRE DEL AFILIADO</th>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>Clave</th>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>Afiliación</th>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>Observaciones</th>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>VALOR Q.</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map(p => (
                <tr key={p.formulario_no}>
                  <td style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "center" }}>{p.formulario_no}</td>
                  <td style={{ border: "1px solid #999", padding: "4px 6px" }}>{p.nombre_afiliado}</td>
                  <td style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "center" }}>12.10.09.</td>
                  <td style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "center", fontFamily: "monospace" }}>{p.afiliacion}</td>
                  <td style={{ border: "1px solid #999", padding: "4px 6px", fontSize: "8pt" }}>{p.observaciones ?? ""}</td>
                  <td style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "right", fontFamily: "monospace" }}>{Q(p.valor_pasaje)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "right", fontWeight: "bold" }}>TOTAL</td>
                <td style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "right", fontWeight: "bold", fontFamily: "monospace" }}>{Q(total)}</td>
              </tr>
            </tfoot>
          </table>
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
