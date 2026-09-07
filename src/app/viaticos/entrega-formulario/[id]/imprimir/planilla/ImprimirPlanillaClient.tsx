"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { montoEnLetras } from "@/lib/adjudicacion/deletreo";

// "Planilla de Viáticos" — respalda "Otros Gastos Derivados" (campo 10 del
// V-L) cuando no hay boletos/comprobantes del gasto (típicamente pasajes).
// Documento generado de cero (sin talonario físico detrás), mismo criterio
// que Informe de Comisión/Justificación de Estancia. Layout y texto de
// OBSERVACIONES extraídos de un ejemplo real (MODELO_VIATICO.pdf, pág. 4,
// 2026-09-07) — el cliente confirmó que "Otros gastos derivados" se captura
// una sola vez por solicitud (no por comisión), así que los datos de viaje
// (lugar/fecha/horario) de este documento son los de la PRIMERA comisión de
// la solicitud (mismo criterio ya usado para el firmante del V-L/Informe).

const OBSERVACIONES_FIJA = `La presente ampara la falta de documentos relacionados a los boletos de pasaje, misma que obedece al Acuerdo 1192 de Junta Directiva, en su artículo 8, en donde literalmente dice "COMPROBACIÓN: los otros gastos a los que se refiere el artículo 3, se comprobarán así: los del inciso a) con los boletos respectivos; a falta de documentos, se comprobarán con la planilla respectiva, pero su monto no podrá ser superior al valor correspondiente establecido por la empresa de transporte"; por lo antes expuesto, dicho monto no sobrepasa lo establecido por la empresa de transporte, autorizado según Resolución 1007-SPS/2025.`;

function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;

type Gasto = { id: number; fecha: string | null; descripcion: string | null; valor: number };

interface Props {
  numeroFormulario: string | null;
  nombreUnidad: string;
  direccionUnidad: string;
  lugarComision: string;
  fechaComision: string | null;
  horaInicio: string | null;
  horaFin: string | null;
  personaNombre: string | null;
  personaCargo: string | null;
  personaNoEmpleado: string | null;
  personaNit: string | null;
  personaSueldo: number | null;
  fechaSalidaUnidad: string | null;
  horaSalidaUnidad: string | null;
  fechaEntradaUnidad: string | null;
  horaEntradaUnidad: string | null;
  gastos: Gasto[];
  lugarYFecha: string;
}

export default function ImprimirPlanillaClient({
  numeroFormulario, nombreUnidad, direccionUnidad, lugarComision, fechaComision, horaInicio, horaFin,
  personaNombre, personaCargo, personaNoEmpleado, personaNit, personaSueldo,
  fechaSalidaUnidad, horaSalidaUnidad, fechaEntradaUnidad, horaEntradaUnidad, gastos, lugarYFecha,
}: Props) {
  const router = useRouter();
  const total = gastos.reduce((sum, g) => sum + (g.valor || 0), 0);

  const Fila = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <tr>
      <td className="pl-fila-label">{label}</td>
      <td className="pl-fila-valor">{children}</td>
    </tr>
  );

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">Planilla de Viáticos — Formulario {numeroFormulario ?? ""}</span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div id="pl-wrapper">
        <div id="pl-page">
          <div className="pl-header">
            <div className="pl-header-texto">
              <p className="pl-header-titulo">Instituto Guatemalteco de Seguridad Social</p>
              <p className="pl-header-sub">{nombreUnidad}</p>
            </div>
            <div className="pl-header-direccion">{direccionUnidad}</div>
          </div>

          <p className="pl-titulo">"Planilla de Viáticos"</p>
          <p className="pl-motivo">
            Ocasionados con motivo de haber realizado comisión a: <strong>{lugarComision}</strong>
          </p>

          <table className="pl-tabla-datos">
            <tbody>
              <Fila label="En fecha">{fechaCorta(fechaComision)}</Fila>
              <Fila label="En horario de">{horaInicio ? `${horaInicio} a ${horaFin ?? ""} horas` : ""}</Fila>
              <Fila label="Nombre">{personaNombre}</Fila>
              <Fila label="No. de empleado">{personaNoEmpleado}</Fila>
              <Fila label="NIT">{personaNit}</Fila>
              <Fila label="Sueldo mensual">{personaSueldo != null ? Q(personaSueldo) : ""}</Fila>
              <Fila label="Cargo">{personaCargo}</Fila>
              <Fila label="Fecha y hora de salida">{fechaSalidaUnidad ? `${fechaCorta(fechaSalidaUnidad)} ${horaSalidaUnidad ?? ""} Hrs.` : ""}</Fila>
              <Fila label="Fecha y hora de entrada">{fechaEntradaUnidad ? `${fechaCorta(fechaEntradaUnidad)} ${horaEntradaUnidad ?? ""} Hrs.` : ""}</Fila>
            </tbody>
          </table>

          <table className="pl-tabla-gastos">
            <thead>
              <tr>
                <th className="pl-th-fecha">Fecha</th>
                <th>Descripción</th>
                <th className="pl-th-valor">Valor</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map(g => (
                <tr key={g.id}>
                  <td>{fechaCorta(g.fecha)}</td>
                  <td>{g.descripcion}</td>
                  <td className="pl-td-valor">{Q(g.valor)}</td>
                </tr>
              ))}
              {gastos.length === 0 && (
                <tr><td colSpan={3} className="pl-sin-gastos">Sin gastos registrados</td></tr>
              )}
              <tr className="pl-fila-total">
                <td colSpan={2}></td>
                <td className="pl-td-valor">{Q(total)}</td>
              </tr>
            </tbody>
          </table>

          <div className="pl-son">
            <span className="pl-son-label">Son:</span> {montoEnLetras(total)}
          </div>

          <div className="pl-observaciones">
            <span className="pl-observaciones-label">Observaciones:</span> {OBSERVACIONES_FIJA}
          </div>

          <div className="pl-firma">
            <p className="pl-firma-linea">{personaNombre}</p>
            <p>{personaCargo}</p>
          </div>

          <p className="pl-lugar-fecha">Lugar y fecha: {lugarYFecha}</p>
        </div>
      </div>

      <style>{`
        #pl-wrapper {
          background: #94a3b8; display: flex; justify-content: center;
          padding: 40px 20px; min-height: 100vh; margin-top: 68px; box-sizing: border-box;
        }
        #pl-page {
          width: 8.5in; min-height: 11in; background: white; box-shadow: 0 4px 32px rgba(0,0,0,0.22);
          box-sizing: border-box; padding: 0.7in; flex-shrink: 0; font-size: 9.5pt; color: #111827;
        }
        .pl-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
          border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 14px; }
        .pl-header-titulo { font-weight: 700; font-size: 11pt; margin: 0; }
        .pl-header-sub { margin: 2px 0 0; font-size: 8.5pt; max-width: 4.6in; }
        .pl-header-direccion { font-size: 7.5pt; text-align: right; color: #4b5563; white-space: pre-line; }
        .pl-titulo { text-align: center; font-weight: 700; font-size: 12pt; margin: 0 0 4px; }
        .pl-motivo { text-align: center; font-size: 9.5pt; margin: 0 0 14px; }
        table.pl-tabla-datos { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
        table.pl-tabla-datos td { border: 1px solid #111827; padding: 4px 8px; vertical-align: top; }
        .pl-fila-label { font-weight: 700; width: 2.1in; background: #f3f4f6; }
        table.pl-tabla-gastos { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        table.pl-tabla-gastos th, table.pl-tabla-gastos td { border: 1px solid #111827; padding: 5px 8px; }
        table.pl-tabla-gastos th { background: #111827; color: white; text-align: left; font-size: 9pt; }
        .pl-th-fecha { width: 1.1in; } .pl-th-valor { width: 1.3in; text-align: right; }
        .pl-td-valor { text-align: right; font-variant-numeric: tabular-nums; }
        .pl-sin-gastos { text-align: center; color: #9ca3af; font-style: italic; padding: 18px 8px; }
        .pl-fila-total td { font-weight: 700; border-top: 2px solid #111827; }
        .pl-son { background: #111827; color: white; padding: 6px 10px; margin-bottom: 12px; font-size: 9.5pt; }
        .pl-son-label { font-weight: 700; }
        .pl-observaciones { border: 1px solid #111827; padding: 8px 10px; font-size: 8.5pt; line-height: 1.5; margin-bottom: 40px; }
        .pl-observaciones-label { font-weight: 700; }
        .pl-firma { text-align: center; margin-top: 10px; font-size: 9.5pt; }
        .pl-firma-linea { border-top: 1px solid #111827; display: inline-block; padding-top: 3px; min-width: 3in; font-weight: 600; }
        .pl-lugar-fecha { text-align: center; margin-top: 10px; font-size: 9.5pt; }
        .no-print { display: block; }
        @media print {
          @page { size: letter; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          #pl-wrapper { background: white !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; }
          #pl-page { box-shadow: none !important; }
        }
      `}</style>
    </>
  );
}
