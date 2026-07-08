"use client";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";

type PolizaRow = { numero: number; fecha: string; total: number };
type Item = {
  formulario_no: number; fecha_pago: string; afiliacion: string; nombre_afiliado: string;
  calidad: string | null; valor_pasaje: number;
};

interface Props {
  poliza: PolizaRow;
  items: Item[];
  codigoContable: string;
  nombreUnidad: string;
  nombreEncargado: string; cargoEncargado: string;
}

const Q = (n: number) => n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

const FONT = "Arial, Helvetica, sans-serif";
const C = "#000";

export default function ImprimirPolizaClient({ poliza, items, codigoContable, nombreUnidad, nombreEncargado, cargoEncargado }: Props) {
  const router = useRouter();
  const fechas = items.map(i => i.fecha_pago).sort();
  const desde = fechas[0] ?? poliza.fecha;
  const hasta = fechas[fechas.length - 1] ?? poliza.fecha;
  const anio = poliza.fecha.slice(0, 4);
  const codigoDigits = codigoContable.replace(/\D/g, "");
  const polizaNo = `${codigoContable.slice(0, 2)}-${anio}-${codigoDigits}`;

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">Cuadro de Caja No. {poliza.numero}</span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div id="print-wrapper">
        <div id="a4-sheet" style={{ fontFamily: FONT, color: C, padding: "16px" }}>

          <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold" }}>INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL</p>
          <p style={{ margin: "1px 0 10px 0", fontSize: "8.5pt" }}>Depto. De Auditoria Interna</p>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", marginBottom: "6px" }}>
            <span>Póliza No. <strong>{polizaNo}</strong></span>
            <span>Cuadro de Caja No. <strong>{poliza.numero}</strong></span>
          </div>

          <p style={{ margin: "0 0 4px 0", fontSize: "9.5pt" }}>
            Pasajes Pagados de la Caja: <strong>{nombreUnidad}.</strong>
          </p>
          <p style={{ margin: "0 0 12px 0", fontSize: "9.5pt" }}>
            Durante la semana comprendida del: <strong>{fechaLarga(desde)}</strong> al: <strong>{fechaLarga(hasta)}</strong>
          </p>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>No. COMP</th>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>NOMBRE DEL AFILIADO</th>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>Sobre Clínico</th>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>Clave Administrativa</th>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>VALOR Q.</th>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>Afiliación</th>
                <th style={{ border: "1px solid #999", padding: "4px 6px", background: "#f1f5f9" }}>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map(i => (
                <tr key={i.formulario_no}>
                  <td style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "center" }}>{i.formulario_no}-{anio}</td>
                  <td style={{ border: "1px solid #999", padding: "4px 6px" }}>{i.nombre_afiliado}</td>
                  <td style={{ border: "1px solid #999", padding: "4px 6px" }}></td>
                  <td style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "center" }}>{codigoContable}.</td>
                  <td style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "right", fontFamily: "monospace" }}>Q {Q(i.valor_pasaje)}</td>
                  <td style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "center", fontFamily: "monospace" }}>{i.afiliacion}</td>
                  <td style={{ border: "1px solid #999", padding: "4px 6px" }}>{i.calidad ?? ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "right", fontWeight: "bold" }}>TOTAL</td>
                <td colSpan={3} style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "left", fontWeight: "bold", fontFamily: "monospace" }}>Q {Q(poliza.total)}</td>
              </tr>
            </tfoot>
          </table>

          <div style={{ textAlign: "center", marginTop: "40px", fontSize: "9pt" }}>
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
