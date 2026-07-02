"use client";
import { useState, useMemo } from "react";
import { TrendingUp, BookOpen, Search, X } from "lucide-react";

type Renglon = {
  id: number;
  ejercicio_fiscal: number;
  pg_spg_py_act_ob: string | null;
  subproducto: string | null;
  renglon: number | null;
  nombre: string;
  vigente: number | null;
  modificado: number | null;
  presupuesto: number | null;
  pre_compromiso: number | null;
  compromiso: number | null;
  devengado: number | null;
  saldo_presupuestario: number | null;
  saldo_disponible: number | null;
};

type CatItem = {
  id: number;
  codigo_ppr: string | null;
  codigo_igss: string | null;
  nombre: string;
  caracteristicas: string | null;
  presentacion: string | null;
  subproducto: string;
  cantidad: number | null;
};

interface Props { renglones: Renglon[]; catalogo: CatItem[] }

const fmtQ = (n: number | null) =>
  (n ?? 0).toLocaleString("es-GT", { style: "currency", currency: "GTQ" });

const sum = (arr: Renglon[], field: keyof Renglon) =>
  arr.reduce((a, r) => a + ((r[field] as number) ?? 0), 0);

export default function PresupuestoClient({ renglones, catalogo }: Props) {
  const [tab,   setTab]  = useState<"presupuesto" | "catalogo">("presupuesto");
  const [query, setQuery] = useState("");

  const filteredRenglones = useMemo(() => {
    if (!query) return renglones;
    const q = query.toLowerCase();
    return renglones.filter(r =>
      r.nombre.toLowerCase().includes(q) ||
      String(r.renglon).includes(q) ||
      (r.subproducto ?? "").toLowerCase().includes(q)
    );
  }, [renglones, query]);

  const filteredCatalogo = useMemo(() => {
    if (!query) return catalogo;
    const q = query.toLowerCase();
    return catalogo.filter(r =>
      r.nombre.toLowerCase().includes(q) ||
      (r.codigo_ppr ?? "").includes(q) ||
      (r.codigo_igss ?? "").includes(q) ||
      (r.caracteristicas ?? "").toLowerCase().includes(q)
    );
  }, [catalogo, query]);

  const totals = useMemo(() => ({
    vigente:              sum(filteredRenglones, "vigente"),
    modificado:           sum(filteredRenglones, "modificado"),
    presupuesto:          sum(filteredRenglones, "presupuesto"),
    pre_compromiso:       sum(filteredRenglones, "pre_compromiso"),
    compromiso:           sum(filteredRenglones, "compromiso"),
    devengado:            sum(filteredRenglones, "devengado"),
    saldo_presupuestario: sum(filteredRenglones, "saldo_presupuestario"),
    saldo_disponible:     sum(filteredRenglones, "saldo_disponible"),
  }), [filteredRenglones]);

  function handleTabChange(t: "presupuesto" | "catalogo") {
    setTab(t);
    setQuery("");
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" /> Presupuesto 2026
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: "presupuesto", label: "Renglones presupuestarios", icon: <TrendingUp className="w-4 h-4" /> },
          { key: "catalogo",    label: "Catálogo PAC",              icon: <BookOpen    className="w-4 h-4" /> },
        ] as const).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={tab === "presupuesto" ? "Buscar renglón o descripción…" : "Buscar por nombre, código PPR o código IGSS…"}
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Tab: Presupuesto ── */}
      {tab === "presupuesto" && (
        <>
          <div className="flex items-center justify-end">
            <span className="text-sm text-gray-500">{filteredRenglones.length} de {renglones.length} renglones</span>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Vigente",          value: totals.vigente,         color: "blue"   },
              { label: "Presupuesto",      value: totals.presupuesto,     color: "indigo" },
              { label: "Devengado",        value: totals.devengado,       color: "amber"  },
              { label: "Saldo disponible", value: totals.saldo_disponible,color: "green"  },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl border border-${color}-100 bg-${color}-50 p-4`}>
                <p className={`text-xs font-medium text-${color}-600 mb-1`}>{label}</p>
                <p className={`text-base font-bold text-${color}-800 truncate`}>{fmtQ(value)}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Renglón</th>
                  <th className="px-4 py-3 text-left font-semibold">Descripción</th>
                  <th className="px-4 py-3 text-left font-semibold hidden xl:table-cell">Subproducto</th>
                  <th className="px-4 py-3 text-right font-semibold">Vigente</th>
                  <th className="px-4 py-3 text-right font-semibold hidden lg:table-cell">Modificado</th>
                  <th className="px-4 py-3 text-right font-semibold hidden lg:table-cell">Presupuesto</th>
                  <th className="px-4 py-3 text-right font-semibold hidden lg:table-cell">Compromiso</th>
                  <th className="px-4 py-3 text-right font-semibold hidden md:table-cell">Devengado</th>
                  <th className="px-4 py-3 text-right font-semibold">Saldo disp.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredRenglones.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">No se encontraron renglones</td>
                  </tr>
                ) : (
                  filteredRenglones.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-gray-700 whitespace-nowrap">{r.renglon}</td>
                      <td className="px-4 py-3 text-gray-800 max-w-xs">
                        <span className="line-clamp-2">{r.nombre}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden xl:table-cell whitespace-nowrap">{r.subproducto ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700 whitespace-nowrap">{fmtQ(r.vigente)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500 hidden lg:table-cell whitespace-nowrap">{fmtQ(r.modificado)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500 hidden lg:table-cell whitespace-nowrap">{fmtQ(r.presupuesto)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500 hidden lg:table-cell whitespace-nowrap">{fmtQ(r.compromiso)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-700 hidden md:table-cell whitespace-nowrap">{fmtQ(r.devengado)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-green-700 whitespace-nowrap">{fmtQ(r.saldo_disponible)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredRenglones.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-200 text-xs font-bold text-gray-700">
                  <tr>
                    <td className="px-4 py-3" colSpan={2}>TOTALES ({filteredRenglones.length} renglones)</td>
                    <td className="hidden xl:table-cell" />
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{fmtQ(totals.vigente)}</td>
                    <td className="px-4 py-3 text-right tabular-nums hidden lg:table-cell whitespace-nowrap">{fmtQ(totals.modificado)}</td>
                    <td className="px-4 py-3 text-right tabular-nums hidden lg:table-cell whitespace-nowrap">{fmtQ(totals.presupuesto)}</td>
                    <td className="px-4 py-3 text-right tabular-nums hidden lg:table-cell whitespace-nowrap">{fmtQ(totals.compromiso)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700 hidden md:table-cell whitespace-nowrap">{fmtQ(totals.devengado)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700 whitespace-nowrap">{fmtQ(totals.saldo_disponible)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {/* ── Tab: Catálogo PAC ── */}
      {tab === "catalogo" && (
        <>
          <div className="flex items-center justify-end">
            <span className="text-sm text-gray-500">{filteredCatalogo.length} de {catalogo.length} artículos</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Cód. IGSS</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Cód. PPR</th>
                  <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Características</th>
                  <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">Subproducto</th>
                  <th className="px-4 py-3 text-right font-semibold hidden sm:table-cell whitespace-nowrap">Cant.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredCatalogo.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">No se encontraron artículos</td>
                  </tr>
                ) : (
                  filteredCatalogo.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                        {r.codigo_igss ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {r.codigo_ppr ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        <p className="font-medium max-w-xs truncate">{r.nombre}</p>
                        {r.presentacion && (
                          <p className="text-xs text-gray-400 truncate max-w-xs">{r.presentacion}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell max-w-xs">
                        <span className="line-clamp-2">{r.caracteristicas ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell whitespace-nowrap">
                        {r.subproducto}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700 hidden sm:table-cell whitespace-nowrap">
                        {r.cantidad != null ? r.cantidad.toLocaleString("es-GT") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
