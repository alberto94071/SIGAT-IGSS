"use client";
import { useMemo, useState } from "react";
import { Calculator, Search } from "lucide-react";

type Renglon = {
  id: number;
  ug: number | null;
  cc: number | null;
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

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const HEADERS = [
  "UG", "C.C.", "PG-SPG-PY-ACT-OB", "Sub-Producto", "Renglón", "Nombre",
  "Vigente", "Modificado", "Presupuesto", "Pre-Compromiso", "Compromiso",
  "Devengado", "Saldo Presupuestario", "Saldo Disponible", "Ejecución %",
];

interface Props { renglones: Renglon[]; }

export default function PresupuestoRenglonesTable({ renglones }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return renglones;
    const q = query.toLowerCase();
    return renglones.filter(r =>
      r.nombre.toLowerCase().includes(q) ||
      String(r.renglon ?? "").includes(q) ||
      (r.subproducto ?? "").toLowerCase().includes(q) ||
      (r.pg_spg_py_act_ob ?? "").toLowerCase().includes(q)
    );
  }, [renglones, query]);

  const totales = useMemo(() => filtered.reduce((acc, r) => ({
    vigente: acc.vigente + (r.vigente ?? 0),
    presupuesto: acc.presupuesto + (r.presupuesto ?? 0),
  }), { vigente: 0, presupuesto: 0 }), [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="w-5 h-5" /> Presupuesto por Renglón
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length.toLocaleString("es-GT")} de {renglones.length.toLocaleString("es-GT")} renglones
          </p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por nombre, renglón, subproducto…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="table-header">
                {HEADERS.map(h => (
                  <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap">{r.ug ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap">{r.cc ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.pg_spg_py_act_ob ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.subproducto ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-700 whitespace-nowrap">{r.renglon ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-900 min-w-[240px] max-w-[360px]">
                    <p className="line-clamp-2">{r.nombre}</p>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-900 font-semibold whitespace-nowrap">
                    {r.vigente != null ? Q(r.vigente) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-400 whitespace-nowrap">
                    {r.modificado != null ? Q(r.modificado) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-700 whitespace-nowrap">
                    {r.presupuesto != null ? Q(r.presupuesto) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-400 whitespace-nowrap">
                    {r.pre_compromiso != null ? Q(r.pre_compromiso) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-400 whitespace-nowrap">
                    {r.compromiso != null ? Q(r.compromiso) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-400 whitespace-nowrap">
                    {r.devengado != null ? Q(r.devengado) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-400 whitespace-nowrap">
                    {r.saldo_presupuestario != null ? Q(r.saldo_presupuestario) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-400 whitespace-nowrap">
                    {r.saldo_disponible != null ? Q(r.saldo_disponible) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-400 whitespace-nowrap">
                    {r.devengado != null && r.vigente ? `${((r.devengado / r.vigente) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td colSpan={6} className="px-3 py-2.5 text-right text-gray-700">Total</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{Q(totales.vigente)}</td>
                  <td></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 whitespace-nowrap">{Q(totales.presupuesto)}</td>
                  <td colSpan={6}></td>
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
