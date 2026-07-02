"use client";
import { useState, useMemo } from "react";
import { BookOpen, Search } from "lucide-react";

type Insumo = {
  id: number;
  ug: number | null;
  cc: number | null;
  estructura_programatica: string | null;
  codigo_igss: string | null;
  nombre: string;
  codigo_nombre_ppr: number | null;
  nombre_ppr: string | null;
  codigo_presentacion_ppr: number | null;
  unidad_medida: string | null;
  renglon: number | null;
  subproducto: string;
  cantidad: number | null;
  precio_estimado: number | null;
  monto: number | null;
};

const Q = (n: number) =>
  `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const HEADERS = [
  "UG", "C.C.", "Estructura Programática", "Código IGSS",
  "Nombre Genérico, Forma, Concentración y Presentación",
  "Código Nombre PpR", "Nombre PpR", "Código Presentación PpR",
  "Unidad de Medida", "Renglón", "Sub-Producto",
  "Cantidad", "Precio Estimado", "Monto",
];

interface Props { insumos: Insumo[]; }

export default function CatalogoComprasClient({ insumos: init }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return init;
    const q = query.toLowerCase();
    return init.filter(i =>
      i.nombre.toLowerCase().includes(q) ||
      (i.codigo_igss ?? "").toLowerCase().includes(q) ||
      i.subproducto.toLowerCase().includes(q) ||
      (i.estructura_programatica ?? "").includes(q) ||
      String(i.renglon ?? "").includes(q)
    );
  }, [init, query]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> PAC 2026 — Catálogo de Insumos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length.toLocaleString("es-GT")} de {init.length.toLocaleString("es-GT")} insumos
          </p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por nombre, código IGSS, subproducto…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="table-header">
                {HEADERS.map(h => (
                  <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(i => (
                <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap">{i.ug ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap">{i.cc ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap font-mono">{i.estructura_programatica ?? "—"}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-brand-700 whitespace-nowrap">{i.codigo_igss ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-900 min-w-[280px] max-w-[380px]">
                    <p className="line-clamp-2">{i.nombre}</p>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap">{i.codigo_nombre_ppr ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600 min-w-[200px] max-w-[300px]">
                    <p className="line-clamp-2">{i.nombre_ppr ?? "—"}</p>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap">{i.codigo_presentacion_ppr ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{i.unidad_medida ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-700 whitespace-nowrap">{i.renglon ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-gray-700 whitespace-nowrap">{i.subproducto}</td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-900 font-semibold whitespace-nowrap">
                    {i.cantidad?.toLocaleString("es-GT") ?? "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-700 whitespace-nowrap">
                    {i.precio_estimado != null ? Q(i.precio_estimado) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right font-bold text-green-700 whitespace-nowrap">
                    {i.monto != null ? Q(i.monto) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No se encontraron insumos con ese criterio.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
