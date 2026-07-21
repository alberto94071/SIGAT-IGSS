"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Calculator, Search, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { PresupuestoGeneralRow } from "@/lib/presupuesto-general-actions";

const SCROLL_PASO = 320;

interface Props {
  data: PresupuestoGeneralRow[];
}

const Q = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "—";
  return `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PresupuestoGeneralClient({ data }: Props) {
  const [query, setQuery] = useState("");
  const [orden, setOrden] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const porTexto = q === "" ? data : data.filter(r =>
      r.descripcion.toLowerCase().includes(q) ||
      String(r.renglon).includes(q) ||
      r.subProducto.toLowerCase().includes(q)
    );
    return [...porTexto].sort((a, b) =>
      orden === "asc" ? a.renglon - b.renglon : b.renglon - a.renglon
    );
  }, [data, query, orden]);

  const totales = useMemo(() => filtered.reduce((acc, r) => ({
    vigente: acc.vigente + r.vigente,
    modificado: acc.modificado + r.modificado,
    nuevoVigente: acc.nuevoVigente + r.nuevoVigente,
    preCompromiso: acc.preCompromiso + (r.preCompromiso ?? 0),
    compromiso: acc.compromiso + (r.compromiso ?? 0),
    devengado: acc.devengado + (r.devengado ?? 0),
  }), { vigente: 0, modificado: 0, nuevoVigente: 0, preCompromiso: 0, compromiso: 0, devengado: 0 }), [filtered]);

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="w-5 h-5" /> Presupuesto por Renglón
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length.toLocaleString("es-GT")} de {data.length.toLocaleString("es-GT")} renglones
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Buscar por nombre, renglón, subproducto…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
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
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">PG</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">SPG</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">PY</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">ACT</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">OB</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">Geográfico</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">Fuente</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">Org</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">Corr</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">Fte-Ref</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">Cor-Ref</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">Renglón</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold min-w-[220px]">Descripción</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">Sub-Producto</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">Vigente</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">Modificado</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">Nuevo Vigente</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">Programado</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">Pre-Compromiso</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">Compromiso</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">Devengado</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">Saldo</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">% Ejecutado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r, idx) => (
                <tr key={`${r.renglon}-${r.subProducto}-${idx}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.pg}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.spg}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.py}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.act}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.ob}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.geografico}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.fuente}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.org}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.corr}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.fteRef}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.corRef}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-900 font-semibold whitespace-nowrap">{r.renglon}</td>
                  <td className="px-3 py-2 text-gray-900 min-w-[220px] max-w-[360px]">
                    <p className="line-clamp-2">{r.descripcion}</p>
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.subProducto}</td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-900 font-semibold whitespace-nowrap">{Q(r.vigente)}</td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-600 whitespace-nowrap">{Q(r.modificado)}</td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-900 font-semibold whitespace-nowrap">{Q(r.nuevoVigente)}</td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-400 whitespace-nowrap">{Q(r.programado)}</td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-700 whitespace-nowrap">{Q(r.preCompromiso)}</td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-700 whitespace-nowrap">{Q(r.compromiso)}</td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-700 whitespace-nowrap">{Q(r.devengado)}</td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-400 whitespace-nowrap">{Q(r.saldo)}</td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-400 whitespace-nowrap">
                    {r.porcentajeEjecutado != null ? `${r.porcentajeEjecutado.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td colSpan={14} className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">Total</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{Q(totales.vigente)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{Q(totales.modificado)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{Q(totales.nuevoVigente)}</td>
                  <td></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{Q(totales.preCompromiso)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{Q(totales.compromiso)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{Q(totales.devengado)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Calculator className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No se encontraron renglones con ese criterio.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
