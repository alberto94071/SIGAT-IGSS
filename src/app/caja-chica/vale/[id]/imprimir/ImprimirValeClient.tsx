"use client";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import { montoEnLetras } from "@/lib/adjudicacion/deletreo";

type Vale = {
  id: number; numero: number; fecha: string; monto: number; monto_autorizado: number | null; motivo: string;
  solicitante_nombre: string; solicitante_numero_empleado: string; solicitante_nit: string;
  jefe_nombre: string; jefe_numero_empleado: string; jefe_nit: string;
  numero_cheque: string | null; fecha_emision: string | null; fecha_entregado: string | null;
};

interface Props {
  vale: Vale;
  municipio: string; nombreDependencia: string;
  nombreResponsable: string; numeroEmpleadoResp: string; nitResponsable: string;
}

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}
function fechaNumerica(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const FONT = "Arial, Helvetica, sans-serif";
const B = "1.5px solid #1a1a1a";
const C = "#000";

export default function ImprimirValeClient({
  vale: v, municipio, nombreDependencia, nombreResponsable, numeroEmpleadoResp, nitResponsable,
}: Props) {
  const router = useRouter();
  const correlativo = String(v.numero).padStart(7, "0");
  const monto = v.monto_autorizado ?? v.monto;

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">Vale de Caja Chica — {correlativo}</span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div id="print-wrapper">
        <div id="a4-sheet" style={{ fontFamily: FONT, color: C, border: B, borderRadius: "8px", padding: "18px" }}>

          {/* Encabezado */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "14px" }}>
            <img src="/LOGO_SIAF01.svg" alt="IGSS" style={{ height: "56px", width: "auto", flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "11pt", fontWeight: "bold" }}>INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "9pt", fontWeight: "bold" }}>FONDO ROTATIVO INTERNO</p>
              <p style={{ margin: "6px 0 0 0", fontSize: "15pt", fontWeight: "bold" }}>VALE DE CAJA CHICA</p>
            </div>
            <div style={{ width: "160px", flexShrink: 0, textAlign: "right", fontSize: "9pt" }}>
              <p style={{ margin: 0 }}>No.</p>
              <p style={{ margin: "0 0 8px 0", fontWeight: "bold", fontSize: "15pt", fontFamily: "monospace" }}>{correlativo}</p>
              <p style={{ margin: 0 }}>Por Q.</p>
              <p style={{ margin: 0, fontWeight: "bold", fontSize: "13pt" }}>{monto.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Cuerpo */}
          <div style={{ fontSize: "10pt", padding: "0 4px" }}>
            <p style={{ margin: "0 0 10px 0" }}>
              <span style={{ display: "inline-block", width: "150px" }}>Lugar y fecha:</span>
              <strong style={{ fontSize: "11pt" }}>{municipio}, {fechaCorta(v.fecha)}</strong>
            </p>

            <p style={{ margin: "0 0 2px 0" }}>
              <span style={{ display: "inline-block", width: "260px" }}>Vale al Fondo Rotativo Interno de:</span>
              <strong style={{ fontSize: "11pt" }}>{nombreDependencia}.</strong>
            </p>
            <p style={{ margin: "0 0 12px 260px", textAlign: "center", fontSize: "8pt", color: "#555" }}>
              (Nombre de la Dependencia Médica o Administrativa)
            </p>

            <p style={{ margin: "0 0 2px 0" }}>
              <span style={{ display: "inline-block", width: "110px" }}>La cantidad de:</span>
              <strong style={{ fontSize: "11pt" }}>{montoEnLetras(monto)}</strong>
            </p>
            <p style={{ margin: "0 0 12px 110px", textAlign: "center", fontSize: "8pt", color: "#555" }}>(En letras)</p>

            <p style={{ margin: "0 0 2px 0" }}>
              <span style={{ display: "inline-block", width: "90px" }}>Motivo:</span>
              <strong>{v.motivo}</strong>
            </p>
            <p style={{ margin: "0 0 20px 90px", fontSize: "8pt", color: "#555" }}>
              (Indique el destino que dará al vale)
            </p>

            {/* Firmas solicitante / jefe */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "10px" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ borderBottom: "1px solid #000", height: "40px" }} />
                <p style={{ margin: "2px 0 0 0", fontSize: "8.5pt" }}>Firma y sello del solicitante y responsable del Vale</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 2px 0", fontSize: "8.5pt" }}>Vo. Bo.</p>
                <div style={{ borderBottom: "1px solid #000", height: "28px" }} />
                <p style={{ margin: "2px 0 0 0", fontSize: "8.5pt" }}>Firma y sello del Jefe de la Dependencia</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", fontSize: "9pt", marginBottom: "16px" }}>
              <div>
                <p style={{ margin: "0 0 3px 0" }}><span style={{ color: "#555" }}>Nombres y apellidos:</span> <strong>{v.solicitante_nombre}</strong></p>
                <p style={{ margin: "0 0 3px 0" }}><span style={{ color: "#555" }}>Número de Empleado:</span> <strong>{v.solicitante_numero_empleado}</strong></p>
                <p style={{ margin: 0 }}><span style={{ color: "#555" }}>NIT:</span> <strong>{v.solicitante_nit}</strong></p>
              </div>
              <div>
                <p style={{ margin: "0 0 3px 0" }}><span style={{ color: "#555" }}>Nombres y apellidos:</span> <strong>{v.jefe_nombre}</strong></p>
                <p style={{ margin: "0 0 3px 0" }}><span style={{ color: "#555" }}>Número de Empleado:</span> <strong>{v.jefe_numero_empleado}</strong></p>
                <p style={{ margin: 0 }}><span style={{ color: "#555" }}>NIT:</span> <strong>{v.jefe_nit}</strong></p>
              </div>
            </div>

            {/* Firma responsable de fondo rotativo + cuadro de cheque */}
            <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ textAlign: "center", maxWidth: "320px" }}>
                  <div style={{ borderBottom: "1px solid #000", height: "40px" }} />
                  <p style={{ margin: "2px 0 0 0", fontSize: "8.5pt" }}>Firma y sello del responsable del Fondo Rotativo, S.M.</p>
                </div>
                <div style={{ fontSize: "9pt", marginTop: "8px" }}>
                  <p style={{ margin: "0 0 3px 0" }}><span style={{ color: "#555" }}>Nombres y apellidos:</span> <strong>{nombreResponsable}</strong></p>
                  <p style={{ margin: "0 0 3px 0" }}><span style={{ color: "#555" }}>Número de Empleado:</span> <strong>{numeroEmpleadoResp}</strong></p>
                  <p style={{ margin: 0 }}><span style={{ color: "#555" }}>NIT:</span> <strong>{nitResponsable}</strong></p>
                </div>
              </div>
              <div style={{ border: B, borderRadius: "6px", padding: "10px 14px", fontSize: "9pt", minWidth: "200px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                  <span style={{ color: "#555" }}>CHEQUE No.:</span> <strong>{v.numero_cheque}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                  <span style={{ color: "#555" }}>VALOR Q.:</span> <strong>{Q(monto)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                  <span style={{ color: "#555" }}>FECHA EMISIÓN:</span> <strong>{fechaNumerica(v.fecha_emision)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#555" }}>ENTREGADO EL:</span> <strong>{fechaNumerica(v.fecha_entregado)}</strong>
                </div>
              </div>
            </div>

            <p style={{ marginTop: "22px", fontSize: "7.5pt", color: "#333", borderTop: "1px solid #999", paddingTop: "8px" }}>
              <strong>NOTA:</strong> El vale se otorga conforme lo establecido en el Manual de Normas y Procedimientos del Régimen
              del Fondo Rotativo Institucional y Fondos Rotativos Internos y debe liquidarse dentro de los cinco (5) días hábiles
              siguientes de haber recibido su valor, si hubiere remanente de efectivo se depositará a la cuenta monetaria del
              Fondo Rotativo Interno que corresponda.
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
