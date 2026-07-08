"use client";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import { nombreNatural } from "@/lib/nombre-utils";

type Solicitud = {
  numero: number; fecha: string; afiliacion: string; nombre_afiliado: string;
  direccion: string | null; tramo: string; punto_partida: string; destino: string;
  lugar_especifico: string | null; especialidad: string | null;
  caso_concluido: boolean; fecha_cita: string | null; observaciones: string | null;
};

interface Props {
  solicitud: Solicitud;
  nombreUnidad: string;
  nombreJefe: string; cargoJefe: string;
  nombreSolicitante: string; cargoSolicitante: string;
}

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}/${String(m).padStart(2, "0")}/${y}`;
}

const FONT = "Arial, Helvetica, sans-serif";
const B = "1.5px solid #1a1a1a";
const C = "#000";
const Casilla = ({ marcado }: { marcado: boolean }) => (
  <span style={{ display: "inline-block", width: "14px", height: "14px", border: "1.2px solid #000", textAlign: "center", lineHeight: "14px", fontSize: "10pt", marginRight: "6px" }}>
    {marcado ? "✓" : ""}
  </span>
);

export default function ImprimirSps75Client({
  solicitud: s, nombreUnidad, nombreJefe, cargoJefe, nombreSolicitante, cargoSolicitante,
}: Props) {
  const router = useRouter();
  const destinoCompleto = s.lugar_especifico ? `${s.destino}: ${s.lugar_especifico}` : s.destino;

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">SPS-75 — Solicitud {s.numero}</span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div id="print-wrapper">
        <div id="a4-sheet" style={{ fontFamily: FONT, color: C, border: B, borderRadius: "8px", padding: "20px" }}>

          <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "10px" }}>
            <img src="/LOGO_SIAF01.svg" alt="IGSS" style={{ height: "48px", width: "auto", flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "13pt", fontWeight: "bold" }}>SOLICITUD DE GASTOS DE TRANSPORTE</p>
            </div>
            <div style={{ width: "60px", flexShrink: 0, textAlign: "right", fontSize: "9pt", fontWeight: "bold" }}>SPS-75</div>
          </div>

          <div style={{ fontSize: "10.5pt", padding: "0 6px" }}>
            <p style={{ margin: "0 0 10px 0" }}>Fecha: <strong>{fechaCorta(s.fecha)}</strong></p>
            <p style={{ margin: "0 0 10px 0" }}>Caso número: <strong>{s.afiliacion}</strong></p>
            <p style={{ margin: "0 0 16px 0" }}>Nombre afiliado: <strong>{nombreNatural(s.nombre_afiliado)}</strong></p>

            <p style={{ margin: "0 0 2px 0", fontWeight: "bold" }}>{nombreJefe}, {cargoJefe.toUpperCase()}</p>
            <p style={{ margin: "0 0 16px 0" }}>Señor: <span style={{ display: "inline-block", borderBottom: "1px solid #000", width: "70%" }}>&nbsp;</span></p>

            <p style={{ margin: "0 0 16px 0", lineHeight: 1.6 }}>
              Se ruega a esa Dependencia, proporcionar a la persona cuya identificación se cita en el ipígrafe, los gastos indispensables de transporte,
            </p>

            <div style={{ marginBottom: "16px", paddingLeft: "40px" }}>
              <p style={{ margin: "0 0 8px 0" }}><Casilla marcado={s.tramo === "Ida"} />Ida</p>
              <p style={{ margin: 0 }}><Casilla marcado={s.tramo === "Vuelta"} />vuelta</p>
            </div>

            <p style={{ margin: "0 0 16px 0" }}>
              para conducirse a <span style={{ fontWeight: "bold" }}>{destinoCompleto}</span>
            </p>

            <p style={{ margin: "0 0 10px 0" }}>en virtud de que:</p>
            <div style={{ marginBottom: "16px", paddingLeft: "40px" }}>
              <p style={{ margin: "0 0 8px 0" }}><Casilla marcado={s.caso_concluido} />Su caso fue concluido</p>
              <p style={{ margin: 0 }}>
                Se le citó para el día <span style={{ fontWeight: "bold" }}>{s.fecha_cita ? fechaCorta(s.fecha_cita) : ""}</span>
              </p>
            </div>

            <p style={{ margin: "0 0 4px 0" }}>Observaciones:</p>
            <div style={{ borderBottom: "1px solid #999", paddingBottom: "4px", marginBottom: "6px", fontSize: "9.5pt" }}>
              {s.direccion && <>PACIENTE CON RESIDENCIA EN: {s.direccion}.</>}
            </div>
            <div style={{ borderBottom: "1px solid #999", paddingBottom: "4px", marginBottom: "24px", fontSize: "9.5pt", minHeight: "18px" }}>
              {s.observaciones ?? ""}
            </div>

            <p style={{ margin: "0 0 30px 0" }}>Atentamente,</p>

            <p style={{ margin: "0 0 2px 0" }}>Firma del solicitante: <span style={{ display: "inline-block", borderBottom: "1px solid #000", width: "50%" }}>&nbsp;</span></p>
            <p style={{ margin: "0 0 2px 0" }}>Nombre del solicitante: <strong>{nombreSolicitante}</strong></p>
            <p style={{ margin: "0 0 20px 0" }}>Cargo del solicitante: <strong>{cargoSolicitante}</strong></p>

            <p style={{ margin: "0 0 4px 0" }}>Transporte ordenado por: <strong>{s.especialidad ?? ""}</strong></p>
            <p style={{ margin: 0, fontSize: "9pt", color: "#333" }}>Unidad Médica: {nombreUnidad}</p>
          </div>
        </div>
      </div>

      <style>{`
        #print-wrapper {
          background: #94a3b8; display: flex; justify-content: center; align-items: flex-start;
          padding: 40px 20px; min-height: 100vh; margin-top: 52px; box-sizing: border-box;
        }
        #a4-sheet {
          background: white; width: 210mm; min-height: 280mm; box-shadow: 0 4px 32px rgba(0,0,0,0.22);
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
