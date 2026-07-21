"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Calculator, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { PresupuestoGeneralRow } from "@/lib/presupuesto-general-actions";

const SCROLL_PASO = 320;

interface Props {
  data: PresupuestoGeneralRow[];
}

const RANGOS = [
  { label: "100 - 199", min: 100, max: 199 },
  { label: "200 - 299", min: 200, max: 299 },
  { label: "300 - 399", min: 300, max: 399 },
];

const Q = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "—";
  return `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PresupuestoGeneralClient({ data }: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const [renglonBuscado, setRenglonBuscado] = useState("");
  const [orden, setOrden] = useState<"asc" | "desc">("asc");

  const currentRango = RANGOS[activeTab];

  const filtered = useMemo(() => {
    const enRango = data.filter(r => r.renglon >= currentRango.min && r.renglon <= currentRango.max);
    const buscado = renglonBuscado.trim();
    const porRenglon = buscado === "" ? enRango : enRango.filter(r => String(r.renglon).includes(buscado));
    return [...porRenglon].sort((a, b) =>
      orden === "asc" ? a.renglon - b.renglon : b.renglon - a.renglon
    );
  }, [data, currentRango, renglonBuscado, orden]);

  const totales = useMemo(() => filtered.reduce((acc, r) => ({
    vigente: acc.vigente + r.vigente,
    nuevoVigente: acc.nuevoVigente + r.nuevoVigente,
    devengado: acc.devengado + (r.devengado ?? 0),
  }), { vigente: 0, nuevoVigente: 0, devengado: 0 }), [filtered]);

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
  }, [filtered]);

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
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Calculator className="w-5 h-5" /> Presupuesto por Renglón
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {filtered.length.toLocaleString("es-GT")} renglones en el rango {currentRango.label}
        </p>
      </div>

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

      <div className="relative card overflow-hidden">
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
          <table className="w-full text-xs">
            <thead>
              <tr className="table-header">
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">Renglón</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold min-w-[220px]">Descripción</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">Sub-Producto</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">Vigente</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">Ingru</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">Entre Renglones</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">Nuevo Vigente</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">Programado</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">Devengado</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">Saldo Presupuestario</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">% Ejecución</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-400">
                    No hay datos para este rango de renglones.
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr key={`${r.renglon}-${r.subProducto}-${idx}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 tabular-nums text-gray-900 font-semibold whitespace-nowrap">{r.renglon}</td>
                    <td className="px-3 py-2 text-gray-900 min-w-[220px] max-w-[360px]">
                      <p className="line-clamp-2">{r.descripcion}</p>
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.subProducto}</td>
                    <td className="px-3 py-2 tabular-nums text-right text-gray-900 font-semibold whitespace-nowrap">{Q(r.vigente)}</td>
                    <td className="px-3 py-2 tabular-nums text-right text-gray-400 whitespace-nowrap">{Q(r.ingru)}</td>
                    <td className="px-3 py-2 tabular-nums text-right text-gray-400 whitespace-nowrap">{Q(r.entreRenglones)}</td>
                    <td className="px-3 py-2 tabular-nums text-right text-gray-900 font-semibold whitespace-nowrap">{Q(r.nuevoVigente)}</td>
                    <td className="px-3 py-2 tabular-nums text-right text-gray-400 whitespace-nowrap">{Q(r.programado)}</td>
                    <td className="px-3 py-2 tabular-nums text-right text-gray-700 whitespace-nowrap">{Q(r.devengado)}</td>
                    <td className="px-3 py-2 tabular-nums text-right text-gray-400 whitespace-nowrap">{Q(r.saldoPresupuestario)}</td>
                    <td className="px-3 py-2 tabular-nums text-right text-gray-400 whitespace-nowrap">
                      {r.porcentajeEjecucion != null ? `${r.porcentajeEjecucion.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td colSpan={3} className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">Total</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{Q(totales.vigente)}</td>
                  <td colSpan={2}></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{Q(totales.nuevoVigente)}</td>
                  <td></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{Q(totales.devengado)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
