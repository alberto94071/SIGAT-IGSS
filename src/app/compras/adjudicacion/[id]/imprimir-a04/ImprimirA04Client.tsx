"use client";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";

type Consolidacion = {
  id: number; tipo_compra: string | null;
  proveedor_nombre: string | null; proveedor_nit: string | null;
  proveedor_direccion: string | null; proveedor_telefono: string | null;
  total: number | null; monto_bruto: number | null; exento_iva: boolean;
  numero_a04: number | null; anio_a04: number | null; a04_fecha: string | null;
  a04_dte_numero: string | null; a04_dte_serie: string | null; a04_dte_fecha: string | null;
  a04_no_pedido: string | null; a04_descripcion: string | null;
  a04_unidad_medida: string | null; a04_cantidad: number | null;
};
type Renglon = { renglon: number | null; codigo_ppr: string | null; nombre: string };

interface Props {
  consolidacion: Consolidacion;
  renglones: Renglon[];
  nombreUnidad: string; codigoUnidad: string;
  direccionUnidad: string; municipio: string;
  nombreResponsable: string; nombreAnalistaPresupuesto: string; nombreDirector: string;
}

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const FONT = "Arial, Helvetica, sans-serif";
const B = "1.5px solid #1a1a1a";
const R = "8px";
const C = "#000";

const METODOS = ["Baja Cuantía", "Compra Directa", "Contrato Abierto", "Casos de Excepción"] as const;
const METODO_LABEL: Record<string, string> = {
  "Baja Cuantía": "BAJA CUANTÍA", "Compra Directa": "COMPRA DIRECTA",
  "Contrato Abierto": "CONTRATO ABIERTO", "Casos de Excepción": "CASOS DE EXCEPCIÓN",
};

function Radio({ marcado }: { marcado: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: "13px", height: "13px", borderRadius: "50%", border: "1.3px solid #000",
      fontSize: "9pt", fontWeight: "bold", flexShrink: 0,
    }}>
      {marcado ? "X" : ""}
    </span>
  );
}

export default function ImprimirA04Client({
  consolidacion: c, renglones, nombreUnidad, codigoUnidad,
  direccionUnidad, municipio, nombreResponsable, nombreAnalistaPresupuesto, nombreDirector,
}: Props) {
  const router = useRouter();
  const correlativoA04 = `${c.numero_a04}-${c.anio_a04}`;

  // "Consultorio del Instituto en San Marcos / U.I.A.A.D.D.M. en el Municipio de X"
  const [parteConsultorio, parteUiaaddm] = nombreUnidad.includes("/")
    ? nombreUnidad.split("/").map(s => s.trim())
    : [nombreUnidad, nombreUnidad];

  const renglon = renglones[0];
  const montoBruto = c.monto_bruto ?? c.total ?? 0;
  const iva = c.exento_iva ? 0 : montoBruto * 0.12;
  const liquido = c.total ?? (montoBruto - iva);

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
        <div id="a4-sheet" style={{ fontFamily: FONT, color: C }}>

          {/* Encabezado: logo + forma + título */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
            <img src="/LOGO_SIAF01.svg" alt="IGSS" style={{ height: "48px", width: "auto", flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ margin: 0, fontWeight: "bold", fontSize: "12pt" }}>ORDEN PARA RENDIR FONDO ROTATIVO</p>
            </div>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "9pt", flexShrink: 0, whiteSpace: "nowrap" }}>FORMA: A-04 SIAF</p>
          </div>

          {/* Recuadro: Datos Unidad Ejecutora / Método de Compra */}
          <div style={{ border: B, borderRadius: R, display: "flex", marginBottom: "10px", fontSize: "9pt" }}>
            <div style={{ flex: 1, padding: "10px 12px", borderRight: B }}>
              <p style={{ margin: "0 0 8px 0", fontWeight: "bold", textAlign: "center", fontSize: "8.5pt" }}>
                DATOS UNIDAD EJECUTORA / CENTRO DE COSTO
              </p>
              <div style={{ display: "flex", gap: "14px", marginBottom: "4px" }}>
                <span><strong>Correlativo No.</strong> {correlativoA04}</span>
                <span><strong>Fecha:</strong> {c.a04_fecha ?? "—"}</span>
                <span><strong>Código Unidad Ejecutora:</strong> {codigoUnidad}</span>
              </div>
              <p style={{ margin: "0 0 4px 0" }}>
                <strong>Nombre Unidad Ejecutora o Centro de Costo:</strong><br />
                <strong>{nombreUnidad}</strong>
              </p>
              <p style={{ margin: 0 }}>
                <strong>Dirección Unidad Ejecutora o centro de Costo:</strong> {direccionUnidad}, {municipio}
              </p>
            </div>
            <div style={{ width: "180px", flexShrink: 0, padding: "10px 12px" }}>
              <p style={{ margin: "0 0 8px 0", fontWeight: "bold", textAlign: "center", fontSize: "8.5pt" }}>MÉTODO DE COMPRA</p>
              {METODOS.map(m => (
                <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span>{METODO_LABEL[m]}</span>
                  <Radio marcado={c.tipo_compra === m} />
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>OTROS</span>
                <span style={{ borderBottom: "1px solid #000", width: "40px", height: "12px" }} />
              </div>
            </div>
          </div>

          {/* Recuadro: Datos del proveedor */}
          <div style={{ border: B, borderRadius: R, padding: "10px 12px", marginBottom: "10px", fontSize: "9pt" }}>
            <p style={{ margin: "0 0 8px 0", fontWeight: "bold", textAlign: "center", fontSize: "8.5pt" }}>DATOS DEL PROVEEDOR</p>
            <div style={{ display: "flex", marginBottom: "4px" }}>
              <span style={{ flex: 1 }}><strong>Nombre o Razón Social:</strong> {c.proveedor_nombre ?? "—"}</span>
              <span style={{ width: "180px", flexShrink: 0 }}><strong>NIT/CUI:</strong> {c.proveedor_nit ?? "—"}</span>
            </div>
            <div style={{ display: "flex" }}>
              <span style={{ flex: 1 }}><strong>Dirección:</strong> {c.proveedor_direccion ?? "—"}</span>
              <span style={{ width: "180px", flexShrink: 0 }}><strong>Teléfono:</strong> {c.proveedor_telefono ?? "—"}</span>
            </div>
          </div>

          {/* Recuadro: Detalle de bienes y/o servicios */}
          <div style={{ border: B, borderRadius: R, padding: "10px 12px", marginBottom: "10px", fontSize: "9pt" }}>
            <p style={{ margin: "0 0 4px 0", fontWeight: "bold", textAlign: "center", fontSize: "8.5pt" }}>
              DETALLE DE BIENES Y/O SERVICIOS
            </p>
            <p style={{ margin: "0 0 8px 0", textAlign: "center", fontSize: "8pt" }}>
              ADQUIRIDOS SEGÚN DOCUMENTO TRIBUTARIO ELECTRÓNICO -DTE- No. <strong>{c.a04_dte_numero ?? "—"}</strong>
              &nbsp;&nbsp;Serie: <strong>{c.a04_dte_serie ?? "—"}</strong>
              &nbsp;&nbsp;de fecha: <strong>{c.a04_dte_fecha ?? "—"}</strong>
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt" }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>No. Pedido</th>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>Código PpR</th>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>Renglón</th>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>Descripción</th>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>Unidad de Medida</th>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>Cantidad</th>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>Precio Unitario</th>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>Total</th>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>(-) IVA</th>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>Liquido</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: "1px solid #333", padding: "4px", textAlign: "center" }}>{c.a04_no_pedido ?? "—"}</td>
                  <td style={{ border: "1px solid #333", padding: "4px", textAlign: "center" }}>{renglon?.codigo_ppr ?? "—"}</td>
                  <td style={{ border: "1px solid #333", padding: "4px", textAlign: "center" }}>{renglon?.renglon ?? "—"}</td>
                  <td style={{ border: "1px solid #333", padding: "6px" }}>
                    <p style={{ margin: "0 0 3px 0", fontWeight: "bold" }}>{(renglon?.nombre ?? "").toUpperCase()}</p>
                    <p style={{ margin: 0 }}>{c.a04_descripcion ?? "—"}</p>
                  </td>
                  <td style={{ border: "1px solid #333", padding: "4px", textAlign: "center" }}>{c.a04_unidad_medida ?? "—"}</td>
                  <td style={{ border: "1px solid #333", padding: "4px", textAlign: "center" }}>{c.a04_cantidad?.toLocaleString("es-GT") ?? "—"}</td>
                  <td style={{ border: "1px solid #333", padding: "4px", textAlign: "right" }}>{Q(montoBruto)}</td>
                  <td style={{ border: "1px solid #333", padding: "4px", textAlign: "right" }}>{Q(montoBruto)}</td>
                  <td style={{ border: "1px solid #333", padding: "4px", textAlign: "right" }}>{Q(iva)}</td>
                  <td style={{ border: "1px solid #333", padding: "4px", textAlign: "right" }}>{Q(liquido)}</td>
                </tr>
                <tr>
                  <td colSpan={7} style={{ border: "1px solid #333", padding: "4px", textAlign: "right", fontWeight: "bold" }}>Totales</td>
                  <td style={{ border: "1px solid #333", padding: "4px", textAlign: "right", fontWeight: "bold" }}>{Q(montoBruto)}</td>
                  <td style={{ border: "1px solid #333", padding: "4px", textAlign: "right", fontWeight: "bold" }}>{Q(iva)}</td>
                  <td style={{ border: "1px solid #333", padding: "4px", textAlign: "right", fontWeight: "bold" }}>{Q(liquido)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Firmas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "20px" }}>
            {[
              { nombre: nombreResponsable, cargo: "Encargado de Fondo Rotativo", unidad: parteUiaaddm },
              { nombre: nombreAnalistaPresupuesto, cargo: "Analista de Presupuesto", unidad: parteConsultorio },
              { nombre: nombreDirector, cargo: "Director \"C\"", unidad: parteConsultorio },
            ].map((f, i) => (
              <div key={i} style={{ border: B, borderRadius: R, padding: "28px 10px 10px 10px", textAlign: "center", fontSize: "8.5pt" }}>
                <p style={{ margin: 0, fontWeight: "bold" }}>{f.nombre || "—"}</p>
                <p style={{ margin: "2px 0 0 0" }}>{f.cargo}</p>
                <p style={{ margin: "2px 0 0 0", color: "#444" }}>{f.unidad}</p>
              </div>
            ))}
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
          padding: 14mm; box-sizing: border-box;
        }
        .no-print { display: block; }
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .no-print { display: none !important; }
          #print-wrapper { background: white !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; display: block !important; }
          #a4-sheet { width: 100% !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
        }
      `}</style>
    </>
  );
}
