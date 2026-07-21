"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ChevronDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { EjecucionRow } from "@/lib/ejecucion-actions";

const SCROLL_PASO = 320;

interface Props {
  data: EjecucionRow[];
}

const RANGOS = [
  { label: "100 - 199", min: 100, max: 199 },
  { label: "200 - 299", min: 200, max: 299 },
  { label: "300 - 399", min: 300, max: 399 },
];

const Q = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "Q0.00";
  return `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

type Totales = { totalNormal: number; totalRegularizado: number; saldo: number };

// Colores por grupo — clases completas (no interpoladas) para que Tailwind las detecte.
const COLOR_MAP: Record<string, { header: string; sub: string; body: string }> = {
  slate:  { header: "bg-slate-200",  sub: "bg-slate-100",  body: "bg-slate-50" },
  cyan:   { header: "bg-cyan-200",   sub: "bg-cyan-100",   body: "bg-cyan-50" },
  amber:  { header: "bg-amber-200",  sub: "bg-amber-100",  body: "bg-amber-50" },
  blue:   { header: "bg-blue-200",   sub: "bg-blue-100",   body: "bg-blue-50" },
  violet: { header: "bg-violet-200", sub: "bg-violet-100", body: "bg-violet-50" },
  green:  { header: "bg-green-200",  sub: "bg-green-100",  body: "bg-green-50" },
  teal:   { header: "bg-teal-200",   sub: "bg-teal-100",   body: "bg-teal-50" },
  gray:   { header: "bg-gray-200",   sub: "bg-gray-200",   body: "bg-gray-100" },
};

type Columna =
  | { kind: "simple"; label: string; color: string; get: (r: EjecucionRow, t: Totales) => number }
  | { kind: "group"; label: string; color: string; sub: { label: string; get: (r: EjecucionRow, t: Totales) => number }[] };

// Estructura de columnas de la tabla de Ejecución, igual en las 3 pestañas de
// rango de renglón. Cada grupo con Normal/Regularizado lleva dos casillas
// unidas bajo un mismo título y su propia tonalidad de color.
const COLUMNAS: Columna[] = [
  { kind: "simple", label: "Nuevo Vigente", color: "slate", get: r => r.nuevoVigente },
  {
    kind: "group", label: "Modificaciones", color: "slate",
    sub: [
      { label: "Ingru", get: r => r.modificacionesIngru },
      { label: "Normal", get: r => r.modificacionesNormal },
    ],
  },
  { kind: "simple", label: "Pre-Compromiso", color: "cyan", get: r => r.preCompromiso },
  {
    kind: "group", label: "Compromiso", color: "amber",
    sub: [
      { label: "Normal", get: r => r.compromisoNormal },
      { label: "Regularizado", get: r => r.compromisoRegularizado },
    ],
  },
  {
    kind: "group", label: "Ejecución", color: "blue",
    sub: [
      { label: "Normal", get: r => r.ejecucionNormal },
      { label: "Regularizado", get: r => r.ejecucionRegularizado },
    ],
  },
  {
    kind: "group", label: "Programado", color: "violet",
    sub: [
      { label: "Normal", get: r => r.programadoNormal },
      { label: "Regularizado", get: r => r.programadoRegularizado },
    ],
  },
  {
    kind: "group", label: "Saldo Programado", color: "green",
    sub: [
      { label: "Normal", get: r => r.saldoProgramadoNormal },
      { label: "Regularizado", get: r => r.saldoProgramadoRegularizado },
    ],
  },
  {
    kind: "group", label: "Total Programado", color: "teal",
    sub: [
      { label: "Normal", get: (_r, t) => t.totalNormal },
      { label: "Regularizado", get: (_r, t) => t.totalRegularizado },
    ],
  },
  { kind: "simple", label: "Saldo", color: "gray", get: (_r, t) => t.saldo },
];

const TOTAL_COLSPAN = 3 + COLUMNAS.reduce((n, c) => n + (c.kind === "group" ? 2 : 1), 0);

function calcularTotales(row: EjecucionRow): Totales {
  // Fórmulas de la pestaña EJECUCION del Excel fuente, preservadas tal cual:
  // Total Normal       = Modif.Ingru + Ejecución.Normal + Programado.Normal + Saldo Prog.Normal
  // Total Regularizado = Modif.Normal + Ejecución.Regularizado + Programado.Regularizado + Saldo Prog.Regularizado
  // Saldo               = Nuevo Vigente - (Total Normal + Total Regularizado)
  const totalNormal = row.modificacionesIngru + row.ejecucionNormal + row.programadoNormal + row.saldoProgramadoNormal;
  const totalRegularizado = row.modificacionesNormal + row.ejecucionRegularizado + row.programadoRegularizado + row.saldoProgramadoRegularizado;
  const saldo = row.nuevoVigente - (totalNormal + totalRegularizado);
  return { totalNormal, totalRegularizado, saldo };
}

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
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th rowSpan={2} className="px-4 py-2 text-left font-semibold text-gray-700 w-24 align-bottom">Renglon</th>
                <th rowSpan={2} className="px-4 py-2 text-left font-semibold text-gray-700 min-w-48 align-bottom">Descripcion</th>
                <th rowSpan={2} className="px-4 py-2 text-left font-semibold text-gray-700 w-28 align-bottom">Sub-Producto</th>
                {COLUMNAS.map(col => {
                  const colores = COLOR_MAP[col.color];
                  return col.kind === "simple" ? (
                    <th
                      key={col.label}
                      rowSpan={2}
                      className={`px-4 py-2 text-right font-semibold text-gray-800 w-36 align-bottom border-l border-white ${colores.header}`}
                    >
                      {col.label}
                    </th>
                  ) : (
                    <th
                      key={col.label}
                      colSpan={2}
                      className={`px-4 py-2 text-center font-semibold text-gray-800 border-l border-white ${colores.header}`}
                    >
                      {col.label}
                    </th>
                  );
                })}
              </tr>
              <tr className="border-b border-gray-200">
                {COLUMNAS.filter(c => c.kind === "group").flatMap(col => {
                  const colores = COLOR_MAP[col.color];
                  const grupo = col as Extract<Columna, { kind: "group" }>;
                  return grupo.sub.map((s, i) => (
                    <th
                      key={`${col.label}-${s.label}`}
                      className={`px-4 py-1.5 text-right font-medium text-gray-700 text-xs w-32 ${colores.sub} ${i === 0 ? "border-l border-white" : ""}`}
                    >
                      {s.label}
                    </th>
                  ));
                })}
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={TOTAL_COLSPAN} className="px-4 py-8 text-center text-gray-500">
                    No hay datos para este rango de renglones.
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => {
                  const totales = calcularTotales(row);
                  return (
                    <tr
                      key={`${row.renglon}-${row.subProducto}-${idx}`}
                      className="border-b border-gray-200 hover:bg-gray-50/70 transition-colors"
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
                      {COLUMNAS.flatMap(col => {
                        const colores = COLOR_MAP[col.color];
                        if (col.kind === "simple") {
                          return [
                            <td key={col.label} className={`px-4 py-3 text-right text-gray-700 font-medium ${colores.body}`}>
                              {Q(col.get(row, totales))}
                            </td>,
                          ];
                        }
                        return col.sub.map((s, i) => (
                          <td
                            key={`${col.label}-${s.label}`}
                            className={`px-4 py-3 text-right text-gray-600 ${colores.body} ${i === 0 ? "border-l border-white" : ""}`}
                          >
                            {Q(s.get(row, totales))}
                          </td>
                        ));
                      })}
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
