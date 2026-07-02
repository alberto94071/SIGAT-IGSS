"use client";
import { useState, useMemo } from "react";
import { BookOpen, Search, X } from "lucide-react";

type Item = {
  id: number;
  codigo_ppr: string | null;
  codigo_igss: string | null;
  nombre: string;
  caracteristicas: string | null;
  presentacion: string | null;
  subproducto: string;
  cantidad: number | null;
};

interface Props { items: Item[] }

export default function CatalogoPacClient({ items }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(r =>
      r.nombre.toLowerCase().includes(q) ||
      (r.codigo_ppr ?? "").includes(q) ||
      (r.codigo_igss ?? "").includes(q) ||
      (r.caracteristicas ?? "").toLowerCase().includes(q) ||
      r.subproducto.toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Catálogo PAC 2026
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} de {items.length} artículos
          </p>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, código PPR o código IGSS…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Cód. IGSS</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Cód. PPR</th>
              <th className="px-4 py-3 text-left font-semibold">Nombre</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Características</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell whitespace-nowrap">Subproducto</th>
              <th className="px-4 py-3 text-right font-semibold hidden sm:table-cell whitespace-nowrap">Cantidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-400">
                  No se encontraron artículos
                </td>
              </tr>
            ) : (
              filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700 whitespace-nowrap">
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
    </div>
  );
}
