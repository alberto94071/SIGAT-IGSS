"use client";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";

type Solicitud = {
  numero: number; fecha: string; afiliacion: string; nombre_afiliado: string;
  direccion: string | null; tramo: string; punto_partida: string; destino: string;
  observaciones: string | null;
};

interface Props {
  solicitud: Solicitud;
  nombreUnidad: string;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

const FONT = "Arial, Helvetica, sans-serif";
const B = "1.5px solid #1a1a1a";
const C = "#000";

export default function ImprimirSps75Client({ solicitud: s, nombreUnidad }: Props) {
  const router = useRouter();
  const anio = s.fecha.slice(0, 4);

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">SPS-75 — Solicitud {s.numero}/{anio}</span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div id="print-wrapper">
        <div id="a4-sheet" style={{ fontFamily: FONT, color: C, border: B, borderRadius: "8px", padding: "18px" }}>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8pt", marginBottom: "6px" }}>
            <span />
            <span style={{ fontWeight: "bold" }}>SPS-75</span>
          </div>

          <div style={{ textAlign: "center", marginBottom: "12px" }}>
            <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold" }}>Instituto Guatemalteco de Seguridad Social</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "8.5pt" }}>{nombreUnidad}</p>
            <p style={{ margin: "8px 0 0 0", fontSize: "12pt", fontWeight: "bold", textDecoration: "underline" }}>
              SOLICITUD DE PAGO DE PASAJE
            </p>
          </div>

          <div style={{ fontSize: "10pt", padding: "0 4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
              <span>No. Solicitud: <strong>{s.numero}/{anio}</strong></span>
              <span>Fecha: <strong>{fechaLarga(s.fecha)}</strong></span>
            </div>

            <p style={{ margin: "0 0 16px 0", fontWeight: "bold" }}>Señor: Jefe de Unidad</p>

            <p style={{ margin: "0 0 4px 0" }}><span style={{ display: "inline-block", width: "110px" }}>Caso Número:</span> <strong>{s.afiliacion}</strong></p>
            <p style={{ margin: "0 0 16px 0" }}><span style={{ display: "inline-block", width: "110px" }}>Nombre de afiliado:</span> <strong>{s.nombre_afiliado}</strong></p>

            <p style={{ margin: "0 0 16px 0", lineHeight: 1.6 }}>
              Por este medio solicito se autorice el pago de pasaje correspondiente al tramo de{" "}
              <strong>{s.tramo === "Ida" ? "ida" : "regreso"}</strong>, de <strong>{s.punto_partida}</strong> a <strong>{s.destino}</strong>, a
              favor del afiliado mencionado.
            </p>

            <div style={{ display: "flex", gap: "24px", marginBottom: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ display: "inline-block", width: "14px", height: "14px", border: "1.2px solid #000", textAlign: "center", lineHeight: "14px", fontSize: "10pt" }}>
                  {s.tramo === "Ida" ? "X" : ""}
                </span> Ida
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ display: "inline-block", width: "14px", height: "14px", border: "1.2px solid #000", textAlign: "center", lineHeight: "14px", fontSize: "10pt" }}>
                  {s.tramo === "Vuelta" ? "X" : ""}
                </span> Regreso
              </label>
            </div>

            <p style={{ margin: "0 0 4px 0" }}>Observaciones:</p>
            <div style={{ border: "1px solid #ccc", borderRadius: "6px", padding: "10px 12px", minHeight: "70px", fontSize: "9.5pt", marginBottom: "30px" }}>
              {s.direccion && <p style={{ margin: "0 0 6px 0" }}>PACIENTE CON RESIDENCIA EN: {s.direccion}</p>}
              <p style={{ margin: 0 }}>{s.observaciones ?? ""}</p>
            </div>

            <div style={{ textAlign: "center", maxWidth: "320px", margin: "40px auto 0 auto" }}>
              <div style={{ borderBottom: "1px solid #000", height: "40px" }} />
              <p style={{ margin: "2px 0 0 0", fontSize: "8.5pt" }}>Firma del Solicitante</p>
            </div>
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
