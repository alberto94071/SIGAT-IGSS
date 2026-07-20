"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ChevronDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { EjecucionRow } from "@/lib/ejecucion-actions";

const SCROLL_PASO = 320;

interface Props {
  data: EjecucionRow[];
}

// Encabezados de las columnas D..O tal como aparecen en la pestaña "EJECUCION" del
// Excel fuente: el bloque de renglones 100-199 usa la agrupación Nuevo/Modificaciones/
// Ejecución/Programado/Saldo Programado, mientras que 200-299 y 300-399 usan la
// agrupación por mes (Septiembre..Diciembre) — ambos comparten las mismas 3 fórmulas
// (Total Normal = E+G+I+K, Total Regularizado = F+H+J+L, Saldo = D-(Total N+Total R)).
const HEADERS_BLOQUE1 = [
  "Nuevo Vigente", "Modificaciones Ingru", "Modificaciones Normal",
  "Ejecución Normal", "Ejecución Regularizado",
  "Programado Normal", "Programado Regularizado",
  "Saldo Programado Normal", "Saldo Programado Regularizado",
  "Total Programado Normal", "Total Programado Regularizado", "Saldo Vigente",
];
const HEADERS_BLOQUE_MESES = [
  "Saldo Presupuestario", "Septiembre Normal", "Septiembre Regularizado",
  "Octubre Normal", "Octubre Regularizado",
  "Noviembre Normal", "Noviembre Regularizado",
  "Diciembre Normal", "Diciembre Regularizado",
  "Total Programado Normal", "Total Programado Regularizado", "Saldo",
];

const RANGOS = [
  { label: "100 - 199", min: 100, max: 199, headers: HEADERS_BLOQUE1 },
  { label: "200 - 299", min: 200, max: 299, headers: HEADERS_BLOQUE_MESES },
  { label: "300 - 399", min: 300, max: 399, headers: HEADERS_BLOQUE_MESES },
];

const Q = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "Q0.00";
  return `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function EjecucionClient({ data }: Props) {
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

  // ── Desplazamiento horizontal: barra espejo arriba + flechas fijas + teclado ──
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const syncingScroll = useRef(false);
  const [scrollWidth, setScrollWidth] = useState(0);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const actualizarAncho = () => setScrollWidth(el.scrollWidth);
    actualizarAncho();
    const ro = new ResizeObserver(actualizarAncho);
    ro.observe(el);
    return () => ro.disconnect();
  }, [filteredData]);

  const handleTopScroll = useCallback(() => {
    if (syncingScroll.current) { syncingScroll.current = false; return; }
    if (!topScrollRef.current || !tableScrollRef.current) return;
    syncingScroll.current = true;
    tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
  }, []);

  const handleTableScroll = useCallback(() => {
    if (syncingScroll.current) { syncingScroll.current = false; return; }
    if (!topScrollRef.current || !tableScrollRef.current) return;
    syncingScroll.current = true;
    topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
  }, []);

  const desplazar = useCallback((delta: number) => {
    tableScrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); desplazar(SCROLL_PASO); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); desplazar(-SCROLL_PASO); }
  }, [desplazar]);

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
      <div className="relative bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Barra de desplazamiento espejo, visible arriba de la tabla */}
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="overflow-x-auto overflow-y-hidden border-b border-gray-200 bg-gray-50"
          style={{ height: 14 }}
        >
          <div style={{ width: scrollWidth, height: 1 }} />
        </div>

        {/* Flechas fijas para desplazar sin bajar hasta la barra inferior */}
        <button
          type="button"
          onClick={() => desplazar(-SCROLL_PASO)}
          aria-label="Desplazar hacia la izquierda"
          className="absolute left-2 top-1/2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 border border-gray-300 shadow-md text-gray-600 hover:bg-white hover:text-brand-700 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => desplazar(SCROLL_PASO)}
          aria-label="Desplazar hacia la derecha"
          className="absolute right-2 top-1/2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 border border-gray-300 shadow-md text-gray-600 hover:bg-white hover:text-brand-700 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div
          ref={tableScrollRef}
          onScroll={handleTableScroll}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          className="overflow-x-auto focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-400"
        >
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 w-24">Renglon</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 min-w-48">Descripcion</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 w-28">Sub-Producto</th>
                {currentRango.headers.map(h => (
                  <th key={h} className="px-4 py-2 text-right font-semibold text-gray-700 w-40">{h}</th>
                ))}
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
                filteredData.map((row, idx) => {
                  // Fórmulas de la pestaña EJECUCION del Excel fuente, preservadas tal cual:
                  // Total Programado Normal       = Modif.Ingru + Ejecución.Normal + Programado.Normal + Saldo Prog.Normal
                  // Total Programado Regularizado = Modif.Normal + Ejecución.Regularizado + Programado.Regularizado + Saldo Prog.Regularizado
                  // Saldo                         = Nuevo Vigente - (Total Normal + Total Regularizado)
                  const totalNormal = row.modificacionesIngru + row.ejecucionNormal + row.programadoNormal + row.saldoProgramadoNormal;
                  const totalRegularizado = row.modificacionesNormal + row.ejecucionRegularizado + row.programadoRegularizado + row.saldoProgramadoRegularizado;
                  const saldo = row.nuevoVigente - (totalNormal + totalRegularizado);
                  return (
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
                      <td className="px-4 py-3 text-right text-gray-600">{Q(row.nuevoVigente)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{Q(row.modificacionesIngru)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{Q(row.modificacionesNormal)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{Q(row.ejecucionNormal)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{Q(row.ejecucionRegularizado)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{Q(row.programadoNormal)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{Q(row.programadoRegularizado)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{Q(row.saldoProgramadoNormal)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{Q(row.saldoProgramadoRegularizado)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{Q(totalNormal)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{Q(totalRegularizado)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-brand-600">{Q(saldo)}</td>
                    </tr>
                  );
                })
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
