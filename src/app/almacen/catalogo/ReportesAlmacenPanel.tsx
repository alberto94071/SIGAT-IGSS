"use client";
import { useState } from "react";
import { FileSpreadsheet, Download, X } from "lucide-react";

type Tipo = "ingresados_mes" | "almacenados" | "por_vencer" | "vencidos" | "por_renglon" | "renglon";

const OPCIONES: { id: Tipo; label: string; desc: string }[] = [
  { id: "almacenados",    label: "Insumos almacenados",     desc: "Existencia actual (ingresado y disponible) de todo el catálogo." },
  { id: "ingresados_mes", label: "Ingresados en el mes",     desc: "Todo lo que entró por DAB-60 en un mes específico." },
  { id: "por_vencer",     label: "Próximos a vencer",        desc: "Lotes con existencia dentro de su umbral de alerta." },
  { id: "vencidos",       label: "Vencidos",                 desc: "Lotes con existencia cuya fecha de vencimiento ya pasó." },
  { id: "por_renglon",    label: "Cantidad por renglón",     desc: "Totales agrupados por renglón presupuestario." },
  { id: "renglon",        label: "Un renglón específico",    desc: "Detalle de insumos de un solo renglón." },
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function ReportesAlmacenPanel({ renglonesDisponibles }: { renglonesDisponibles: number[] }) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("almacenados");
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [renglon, setRenglon] = useState<number | "">(renglonesDisponibles[0] ?? "");

  const params = new URLSearchParams({ tipo });
  if (tipo === "ingresados_mes") { params.set("mes", String(mes)); params.set("anio", String(anio)); }
  if (tipo === "renglon" && renglon !== "") params.set("renglon", String(renglon));
  const puedeDescargar = tipo !== "renglon" || renglon !== "";
  const href = `/api/almacen/reporte?${params.toString()}`;

  return (
    <>
      <button onClick={() => setAbierto(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
        <FileSpreadsheet className="w-4 h-4" /> Descargar reporte
      </button>

      {abierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setAbierto(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Reporte de Almacén
              </h2>
              <button onClick={() => setAbierto(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Excel con gráfico incluido — elegí el tipo de reporte que necesitás.
            </p>

            <div className="space-y-1.5">
              {OPCIONES.map(o => (
                <label key={o.id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    tipo === o.id ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:bg-gray-50"
                  }`}>
                  <input type="radio" className="mt-1" checked={tipo === o.id} onChange={() => setTipo(o.id)} />
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">{o.label}</span>
                    <span className="block text-xs text-gray-500">{o.desc}</span>
                  </span>
                </label>
              ))}
            </div>

            {tipo === "ingresados_mes" && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-600">Mes</label>
                  <select className="input mt-1" value={mes} onChange={e => setMes(Number(e.target.value))}>
                    {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="w-28">
                  <label className="text-xs font-semibold text-gray-600">Año</label>
                  <input type="number" className="input mt-1" value={anio} onChange={e => setAnio(Number(e.target.value))} />
                </div>
              </div>
            )}

            {tipo === "renglon" && (
              <div>
                <label className="text-xs font-semibold text-gray-600">Renglón</label>
                {renglonesDisponibles.length > 0 ? (
                  <select className="input mt-1" value={renglon} onChange={e => setRenglon(Number(e.target.value))}>
                    {renglonesDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Todavía no hay insumos con renglón asignado.</p>
                )}
              </div>
            )}

            <a href={puedeDescargar ? href : undefined}
              aria-disabled={!puedeDescargar}
              className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                puedeDescargar ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none"
              }`}>
              <Download className="w-4 h-4" /> Descargar Excel
            </a>
          </div>
        </div>
      )}
    </>
  );
}
