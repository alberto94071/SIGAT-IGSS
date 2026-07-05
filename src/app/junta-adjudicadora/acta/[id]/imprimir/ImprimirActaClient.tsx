"use client";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";

type Acta = {
  id: number; no_formulario: string; no_acta: string; lugar: string; fecha: string; hora: string;
  estado: string;
};
type Consolidacion = {
  id: number; numero: number; anio: number; tipo_compra: string | null;
  numero_adjudicacion: string | null; pre_orden: string | null;
  proveedor_nombre: string | null; proveedor_nit: string | null;
  total: number | null; exento_iva: boolean;
};

interface Props {
  acta: Acta; consolidacion: Consolidacion; siafs: { numero: number; anio: number }[];
  nombreUnidad: string; direccionUnidad: string;
}

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ImprimirActaClient({ acta, consolidacion: c, siafs, nombreUnidad, direccionUnidad }: Props) {
  const router = useRouter();
  const correlativo = c.numero_adjudicacion ? `ADJ-${c.numero_adjudicacion}` : c.pre_orden ? `PRE-${c.pre_orden}` : `${c.numero}/${c.anio}`;
  const fechaLarga = new Date(acta.fecha + "T00:00:00").toLocaleDateString("es-GT", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">Acta {acta.no_acta} — {correlativo}</span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div id="print-wrapper">
        <div id="a4-sheet">
          <div className="no-print" style={{
            marginBottom: "16px", padding: "8px 12px", background: "#fffbeb",
            border: "1px solid #fde68a", borderRadius: "8px", fontSize: "9pt", color: "#92400e",
          }}>
            Formato provisional — aún no se ha cargado el machote oficial del Acta de la Junta Adjudicadora.
            Este documento incluye todos los datos necesarios mientras se define el formato final.
          </div>

          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <p style={{ fontSize: "8pt", color: "#666", margin: 0 }}>No. de Formulario: {acta.no_formulario}</p>
            <p style={{ fontWeight: "bold", fontSize: "13pt", margin: "4px 0 0 0" }}>ACTA No. {acta.no_acta}</p>
            <p style={{ fontSize: "9pt", color: "#666", margin: "4px 0 0 0" }}>Junta Adjudicadora — {nombreUnidad}</p>
          </div>

          <div style={{ border: "1px solid #999", borderRadius: "8px", padding: "12px 16px", marginBottom: "14px", fontSize: "9.5pt" }}>
            <p style={{ margin: 0 }}><strong>Lugar:</strong> {acta.lugar}</p>
            <p style={{ margin: 0 }}><strong>Fecha:</strong> {fechaLarga} &nbsp;·&nbsp; <strong>Hora:</strong> {acta.hora}</p>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "14px" }}>
            <tbody>
              <tr>
                <td style={{ border: "1px solid #999", padding: "6px 10px", width: "40%", fontWeight: "bold", background: "#f5f5f5" }}>Referencia</td>
                <td style={{ border: "1px solid #999", padding: "6px 10px" }}>{correlativo}</td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #999", padding: "6px 10px", fontWeight: "bold", background: "#f5f5f5" }}>Tipo de compra</td>
                <td style={{ border: "1px solid #999", padding: "6px 10px" }}>{c.tipo_compra ?? "—"}</td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #999", padding: "6px 10px", fontWeight: "bold", background: "#f5f5f5" }}>Proveedor adjudicado</td>
                <td style={{ border: "1px solid #999", padding: "6px 10px" }}>{c.proveedor_nombre ?? "—"}</td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #999", padding: "6px 10px", fontWeight: "bold", background: "#f5f5f5" }}>NIT</td>
                <td style={{ border: "1px solid #999", padding: "6px 10px", fontFamily: "monospace" }}>{c.proveedor_nit ?? "—"}</td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #999", padding: "6px 10px", fontWeight: "bold", background: "#f5f5f5" }}>Razón de adjudicación</td>
                <td style={{ border: "1px solid #999", padding: "6px 10px" }}>{c.numero_adjudicacion ?? "—"}</td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #999", padding: "6px 10px", fontWeight: "bold", background: "#f5f5f5" }}>SIAFs consolidados</td>
                <td style={{ border: "1px solid #999", padding: "6px 10px" }}>{siafs.length > 0 ? siafs.map(s => `${s.numero}/${s.anio}`).join(", ") : "—"}</td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #999", padding: "8px 10px", fontWeight: "bold", background: "#f5f5f5" }}>Total adjudicado</td>
                <td style={{ border: "1px solid #999", padding: "8px 10px", fontWeight: "bold", fontSize: "11pt" }}>
                  {c.total != null ? Q(c.total) : "—"} {c.exento_iva ? "(exento de IVA)" : ""}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "60px", fontSize: "9pt", textAlign: "center" }}>
            <div style={{ borderTop: "1.5px solid #222", paddingTop: "6px" }}>
              <p style={{ margin: 0, fontWeight: "bold" }}>Presidente</p>
              <p style={{ margin: 0, color: "#666" }}>Junta Adjudicadora</p>
            </div>
            <div style={{ borderTop: "1.5px solid #222", paddingTop: "6px" }}>
              <p style={{ margin: 0, fontWeight: "bold" }}>Secretario</p>
              <p style={{ margin: 0, color: "#666" }}>Junta Adjudicadora</p>
            </div>
          </div>

          <p style={{ textAlign: "center", fontSize: "8pt", color: "#999", marginTop: "30px" }}>{direccionUnidad}</p>
        </div>
      </div>

      <style>{`
        #print-wrapper {
          background: #94a3b8; display: flex; justify-content: center; align-items: flex-start;
          padding: 40px 20px; min-height: 100vh; margin-top: 52px; box-sizing: border-box;
        }
        #a4-sheet {
          background: white; width: 210mm; min-height: 297mm; box-shadow: 0 4px 32px rgba(0,0,0,0.22);
          padding: 18mm 16mm; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; color: #000;
        }
        .no-print { display: block; }
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          .no-print { display: none !important; }
          #print-wrapper { background: white !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; display: block !important; }
          #a4-sheet { width: 100% !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
        }
      `}</style>
    </>
  );
}
