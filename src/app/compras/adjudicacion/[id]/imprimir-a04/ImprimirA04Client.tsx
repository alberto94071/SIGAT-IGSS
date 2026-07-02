"use client";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";

type Consolidacion = {
  id: number; numero: number; anio: number; fecha: string;
  tipo_compra: string | null; referencia: string | null;
  numero_adjudicacion: string | null;
  proveedor_nombre: string | null; proveedor_nit: string | null;
  total: number | null; exento_iva: boolean;
  numero_cheque: string | null;
  numero_a04: number | null; anio_a04: number | null;
};

interface Props {
  consolidacion: Consolidacion;
  siafs: { numero: number; anio: number }[];
  nombreUnidad: string; codigoUnidad: string; codigoContable: string;
  direccionUnidad: string; municipio: string;
  nombreResponsable: string; numeroEmpleadoResp: string;
  nombreSolicitante: string; numeroEmpleadoSol: string;
}

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ImprimirA04Client({
  consolidacion: c, siafs, nombreUnidad, codigoUnidad, codigoContable,
  direccionUnidad, municipio, nombreResponsable, numeroEmpleadoResp,
  nombreSolicitante, numeroEmpleadoSol,
}: Props) {
  const router = useRouter();
  const correlativoA04 = `${String(c.numero_a04).padStart(3, "0")}-${c.anio_a04}`;
  const hoy = new Date().toLocaleDateString("es-GT", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">A-04 SIAF — {correlativoA04}</span>
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
            Formato provisional — aún no se ha cargado la plantilla oficial de la Forma A-04 SIAF.
            Este documento incluye todos los datos necesarios mientras se define el formato final.
          </div>

          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <p style={{ fontSize: "8pt", color: "#666", margin: 0 }}>FORMA: A-04 SIAF</p>
            <p style={{ fontWeight: "bold", fontSize: "13pt", margin: "2px 0 0 0" }}>ORDEN PARA RENDIR FONDO ROTATIVO</p>
            <p style={{ fontSize: "9pt", color: "#666", margin: "4px 0 0 0" }}>Instituto Guatemalteco de Seguridad Social</p>
          </div>

          <div style={{ border: "1px solid #999", borderRadius: "8px", padding: "12px 16px", marginBottom: "14px", fontSize: "9.5pt" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: "0 0 4px 0", fontWeight: "bold", color: "#555", fontSize: "8pt", textTransform: "uppercase" }}>Datos Unidad Ejecutora</p>
                <p style={{ margin: 0 }}><strong>Nombre:</strong> {nombreUnidad}</p>
                <p style={{ margin: 0 }}><strong>Código:</strong> {codigoUnidad} &nbsp;·&nbsp; <strong>Código Contable:</strong> {codigoContable}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0 }}><strong>Correlativo A-04 N°:</strong> {correlativoA04}</p>
                <p style={{ margin: 0 }}><strong>Fecha de impresión:</strong> {hoy}</p>
                <p style={{ margin: 0 }}><strong>Tipo de compra:</strong> {c.tipo_compra ?? "—"}</p>
              </div>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "14px" }}>
            <tbody>
              <tr>
                <td style={{ border: "1px solid #999", padding: "6px 10px", width: "40%", fontWeight: "bold", background: "#f5f5f5" }}>Proveedor / Beneficiario</td>
                <td style={{ border: "1px solid #999", padding: "6px 10px" }}>{c.proveedor_nombre ?? "—"}</td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #999", padding: "6px 10px", fontWeight: "bold", background: "#f5f5f5" }}>NIT</td>
                <td style={{ border: "1px solid #999", padding: "6px 10px", fontFamily: "monospace" }}>{c.proveedor_nit ?? "—"}</td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #999", padding: "6px 10px", fontWeight: "bold", background: "#f5f5f5" }}>Referencia</td>
                <td style={{ border: "1px solid #999", padding: "6px 10px" }}>{c.referencia ?? "—"}</td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #999", padding: "6px 10px", fontWeight: "bold", background: "#f5f5f5" }}>Razón de adjudicación</td>
                <td style={{ border: "1px solid #999", padding: "6px 10px" }}>{c.numero_adjudicacion ?? "—"}</td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #999", padding: "6px 10px", fontWeight: "bold", background: "#f5f5f5" }}>IVA</td>
                <td style={{ border: "1px solid #999", padding: "6px 10px" }}>{c.exento_iva ? "Exento" : "Con descuento 12%"}</td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #999", padding: "6px 10px", fontWeight: "bold", background: "#f5f5f5" }}>N° de cheque</td>
                <td style={{ border: "1px solid #999", padding: "6px 10px" }}>{c.numero_cheque ?? "—"}</td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #999", padding: "6px 10px", fontWeight: "bold", background: "#f5f5f5" }}>SIAFs consolidados</td>
                <td style={{ border: "1px solid #999", padding: "6px 10px" }}>{siafs.length > 0 ? siafs.map(s => `${s.numero}/${s.anio}`).join(", ") : "—"}</td>
              </tr>
              <tr>
                <td style={{ border: "1px solid #999", padding: "8px 10px", fontWeight: "bold", background: "#f5f5f5" }}>Total a pagar (sin IVA)</td>
                <td style={{ border: "1px solid #999", padding: "8px 10px", fontWeight: "bold", fontSize: "11pt" }}>{c.total != null ? Q(c.total) : "—"}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px", marginTop: "60px", fontSize: "9pt", textAlign: "center" }}>
            <div style={{ borderTop: "1.5px solid #222", paddingTop: "6px" }}>
              <p style={{ margin: 0, fontWeight: "bold" }}>{nombreSolicitante || "—"}</p>
              <p style={{ margin: 0, color: "#666" }}>Solicitante · Empleado {numeroEmpleadoSol}</p>
            </div>
            <div style={{ borderTop: "1.5px solid #222", paddingTop: "6px" }}>
              <p style={{ margin: 0, fontWeight: "bold" }}>{nombreResponsable}</p>
              <p style={{ margin: 0, color: "#666" }}>Responsable FRI · Empleado {numeroEmpleadoResp}</p>
            </div>
            <div style={{ borderTop: "1.5px solid #222", paddingTop: "6px" }}>
              <p style={{ margin: 0, fontWeight: "bold" }}>Autorizado por</p>
              <p style={{ margin: 0, color: "#666" }}>Jefe / Director</p>
            </div>
          </div>

          <p style={{ textAlign: "center", fontSize: "8pt", color: "#999", marginTop: "30px" }}>{direccionUnidad} · {municipio}</p>
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
