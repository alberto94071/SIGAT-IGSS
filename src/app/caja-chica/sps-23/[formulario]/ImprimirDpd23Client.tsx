"use client";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import { montoEnLetras } from "@/lib/adjudicacion/deletreo";

type Pago = {
  formulario_no: number; fecha_pago: string; afiliacion: string; nombre_afiliado: string;
  calidad: string | null; dpi: string | null; punto_partida: string; destino: string;
  ida: boolean; vuelta: boolean; valor_pasaje: number; observaciones: string | null; fecha_cita: string | null;
};

interface Props {
  pago: Pago;
  codigoContable: string;
  nombreSecretaria: string; cargoSecretaria: string;
  nombreEncargado: string; cargoEncargado: string;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

const FONT = "Arial, Helvetica, sans-serif";
const B = "1.5px solid #1a1a1a";
const C = "#000";

export default function ImprimirDpd23Client({
  pago: p, codigoContable, nombreSecretaria, cargoSecretaria, nombreEncargado, cargoEncargado,
}: Props) {
  const router = useRouter();
  const anio = p.fecha_pago ? p.fecha_pago.slice(0, 4) : String(new Date().getFullYear());
  const valorIda = p.ida ? (p.vuelta ? p.valor_pasaje / 2 : p.valor_pasaje) : 0;
  const valorVuelta = p.vuelta ? (p.ida ? p.valor_pasaje / 2 : p.valor_pasaje) : 0;
  const direccion = p.ida && p.vuelta ? "Ida y Vuelta" : p.ida ? "Ida" : "Vuelta";

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">DPD-23 — Formulario {p.formulario_no}/{anio}</span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div id="print-wrapper">
        <div id="a4-sheet" style={{ fontFamily: FONT, color: C, border: B, borderRadius: "8px", padding: "18px" }}>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8pt", marginBottom: "6px" }}>
            <span />
            <span style={{ fontWeight: "bold" }}>DPD-23</span>
          </div>

          <div style={{ textAlign: "center", marginBottom: "10px" }}>
            <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold" }}>Instituto Guatemalteco de Seguridad Social</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "8.5pt" }}>
              Unidad Integral de Adscripción, Acreditación de Derechos y Despacho de Medicamentos en el Municipio de Tejutla.
            </p>
            <p style={{ margin: "8px 0 0 0", fontSize: "13pt", fontWeight: "bold", textDecoration: "underline" }}>
              RECIBO DE GASTOS DE TRANSPORTE
            </p>
          </div>

          <div style={{ fontSize: "10pt", padding: "0 4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <span>No. Correlativo: <strong>{p.formulario_no}/{anio}</strong></span>
              <span>POR: <strong>Q{p.valor_pasaje.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.00</strong></span>
            </div>

            <p style={{ margin: "0 0 4px 0" }}><span style={{ display: "inline-block", width: "70px" }}>Cuenta:</span> <strong>{codigoContable}</strong></p>
            <p style={{ margin: "0 0 4px 0" }}><span style={{ display: "inline-block", width: "70px" }}>Nombre:</span> <strong>{p.nombre_afiliado}</strong></p>
            <p style={{ margin: "0 0 4px 0" }}><span style={{ display: "inline-block", width: "220px" }}>Calidad del Derechohabiente:</span> <strong>{p.calidad ?? ""}</strong></p>
            <p style={{ margin: "0 0 14px 0" }}><span style={{ display: "inline-block", width: "110px" }}>Caso Número:</span> <strong>{p.afiliacion}</strong></p>

            <p style={{ margin: "0 0 20px 0", lineHeight: 1.6 }}>
              Recibí del Instituto Guatemalteco de Seguridad Social la suma de: Q. {p.valor_pasaje.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.00,
              {" "}(en letras) {montoEnLetras(p.valor_pasaje)} en concepto de gastos indispensables de transporte, conforme a la
              {" "}Sección X del Capítulo II del Acuerdo número 466 de Junta Directiva, para conducirse de: <strong>{p.punto_partida}</strong> A: <strong>{p.destino}</strong>.
            </p>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>distribuidos así: <strong>{direccion}</strong></span>
              <span>del día: <strong>{fechaCorta(p.fecha_cita)}</strong></span>
            </div>
            <div style={{ display: "flex", gap: "24px", fontSize: "9pt", color: "#555", marginBottom: "14px" }}>
              {p.ida && <span>Ida: <strong style={{ color: "#000" }}>Q{valorIda.toFixed(2)}</strong></span>}
              {p.vuelta && <span>Vuelta: <strong style={{ color: "#000" }}>Q{valorVuelta.toFixed(2)}</strong></span>}
            </div>

            <p style={{ margin: "0 0 20px 0" }}><span style={{ display: "inline-block", width: "40px" }}>Por:</span> {p.observaciones ?? ""}</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "30px", marginBottom: "10px" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ borderBottom: "1px solid #000", height: "36px" }} />
                <p style={{ margin: "2px 0 0 0", fontSize: "8.5pt" }}>Firma o Huella Digital del<br />Afiliado o Beneficiario</p>
                <p style={{ margin: "6px 0 0 0", fontSize: "8pt", color: "#555" }}>CUI: {p.dpi ?? ""}</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ borderBottom: "1px solid #000", height: "36px" }} />
                <p style={{ margin: "2px 0 0 0", fontSize: "8.5pt" }}>Testigo</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", fontSize: "9pt", marginTop: "24px" }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 2px 0", fontWeight: "bold" }}>{nombreSecretaria}</p>
                <p style={{ margin: 0, color: "#555" }}>{cargoSecretaria}</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "8pt", color: "#777" }}>Gastos de Transporte Solicitados por</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 2px 0", fontWeight: "bold" }}>{nombreEncargado}</p>
                <p style={{ margin: 0, color: "#555" }}>{cargoEncargado}</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "8pt", color: "#777" }}>Elaborado por / Dependencia Encargada</p>
              </div>
            </div>

            <p style={{ marginTop: "22px", fontSize: "8.5pt", color: "#333" }}>
              Tejutla, San Marcos: {fechaCorta(p.fecha_pago)}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        #print-wrapper {
          background: #94a3b8; display: flex; justify-content: center; align-items: flex-start;
          padding: 40px 20px; min-height: 100vh; margin-top: 52px; box-sizing: border-box;
        }
        #a4-sheet {
          background: white; width: 210mm; min-height: 148mm; box-shadow: 0 4px 32px rgba(0,0,0,0.22);
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
