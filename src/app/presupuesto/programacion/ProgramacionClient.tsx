"use client";
import { useState, useMemo } from "react";
import { ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import type { ProgramacionRow } from "@/lib/programacion-actions";

interface Props {
  data: ProgramacionRow[];
}

const RANGOS = [
  { label: "100 - 199", min: 100, max: 199 },
  { label: "200 - 299", min: 200, max: 299 },
  { label: "300 - 399", min: 300, max: 399 },
];

const Q = (n: number | null) => {
  if (n === null || n === undefined) return "Q0.00";
  return `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function ProgramacionClient({ data }: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const [expandedRenglon, setExpandedRenglon] = useState<number | null>(null);
  const [orden, setOrden] = useState<"asc" | "desc">("asc");
  const [renglonBuscado, setRenglonBuscado] = useState("");

  const currentRango = RANGOS[activeTab];

  const filteredData = useMemo(() => {
    const enRango = data.filter(
      row => row.renglon >= currentRango.min && row.renglon <= currentRango.max
    );
    const buscado = renglonBuscado.trim();
    const porRenglon = buscado === "" ? enRango : enRango.filter(row => String(row.renglon).includes(buscado));
    return [...porRenglon].sort((a, b) =>
      orden === "asc" ? a.renglon - b.renglon : b.renglon - a.renglon
    );
  }, [data, currentRango, renglonBuscado, orden]);

  return (
    <div className="space-y-6">
      {/* ── Pestañas por rango ── */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {RANGOS.map((rango, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === idx
                  ? "border-brand-600 text-brand-700 bg-brand-50"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              Renglones {rango.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Controles: filtro por renglón + orden ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium">Buscar renglón:</label>
          <input
            type="text"
            inputMode="numeric"
            value={renglonBuscado}
            onChange={e => setRenglonBuscado(e.target.value.replace(/\D/g, ""))}
            placeholder="Ej. 182"
            className="input w-32 rounded-lg"
          />
          {renglonBuscado !== "" && (
            <button
              onClick={() => setRenglonBuscado("")}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-gray-600 font-medium">Orden:</label>
          <button
            onClick={() => setOrden(orden === "asc" ? "desc" : "asc")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {orden === "asc" ? (
              <>
                <ArrowUp className="w-4 h-4" /> Ascendente
              </>
            ) : (
              <>
                <ArrowDown className="w-4 h-4" /> Descendente
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Tabla de renglones ── */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 w-24">Renglon</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 min-w-48">Descripcion</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 w-28">Sub-Producto</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 w-32">Presupuestario</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 w-40">Septiembre Normal</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 w-40">Septiembre Regularizado</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 w-40">Octubre Normal</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 w-40">Octubre Regularizado</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 w-40">Noviembre Normal</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 w-40">Noviembre Regularizado</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 w-40">Diciembre Normal</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 w-40">Diciembre Regularizado</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 w-32">Total (N)</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 w-32">Total (R)</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-700 w-32">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                    No hay datos para este rango de renglones.
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => (
                  <tr
                    key={`${row.renglon}-${row.subProducto}-${idx}`}
                    className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900">{row.renglon}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <button
                        onClick={() =>
                          setExpandedRenglon(expandedRenglon === row.renglon ? null : row.renglon)
                        }
                        className="flex items-center gap-1 text-brand-600 hover:text-brand-700"
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            expandedRenglon === row.renglon ? "rotate-180" : ""
                          }`}
                        />
                        <span className="truncate max-w-80">{row.descripcion}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{row.subProducto}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{Q(row.presupuestario)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{Q(row.septiembre_normal)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{Q(row.septiembre_regularizado)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{Q(row.octubre_normal)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{Q(row.octubre_regularizado)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{Q(row.noviembre_normal)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{Q(row.noviembre_regularizado)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{Q(row.diciembre_normal)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{Q(row.diciembre_regularizado)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{Q(row.total_normal)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{Q(row.total_regularizado)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand-600">
                      {Q((row.presupuestario ?? 0) - ((row.total_normal ?? 0) + (row.total_regularizado ?? 0)))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Resumen al pie ── */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p className="text-sm text-gray-600">
          <strong>{filteredData.length} renglones</strong> en el rango {currentRango.label}
        </p>
      </div>
    </div>
  );
}
