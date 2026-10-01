"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Search, ChevronDown, ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import type { FilaReporteA01Siaf } from "@/lib/reportes/compras-actions";

const PAGE_SIZES = [25, 50, 100] as const;

const ESTADO_COLOR: Record<string, string> = {
  Borrador: "bg-gray-100 text-gray-700",
  Aprobado: "bg-green-100 text-green-700",
  Rechazado: "bg-red-100 text-red-700",
  Consolidado: "bg-blue-100 text-blue-700",
};

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

interface Props { filas: FilaReporteA01Siaf[]; }

export default function ReporteA01SiafClient({ filas }: Props) {
  const [query, setQuery] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<string | null>(null);
  const [anioFiltro, setAnioFiltro] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(1);

  const anios = useMemo(
    () => [...new Set(filas.map(f => f.siaf_anio))].sort((a, b) => b - a),
    [filas],
  );
  const estados = useMemo(
    () => [...new Set(filas.map(f => f.siaf_estado))].sort(),
    [filas],
  );
  const siafUnicos = useMemo(() => new Set(filas.map(f => f.siaf_id)).size, [filas]);

  const filtered = useMemo(() => {
    let base = filas;
    if (anioFiltro != null) base = base.filter(f => f.siaf_anio === anioFiltro);
    if (estadoFiltro != null) base = base.filter(f => f.siaf_estado === estadoFiltro);
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(f =>
      f.insumo.toLowerCase().includes(q) ||
      f.subproducto.toLowerCase().includes(q) ||
      f.codigo_o_ppr.toLowerCase().includes(q) ||
      `${f.siaf_numero}/${f.siaf_anio}`.includes(q) ||
      String(f.siaf_numero).includes(q)
    );
  }, [filas, query, estadoFiltro, anioFiltro]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const paginated = filtered.slice((pageClamped - 1) * pageSize, pageClamped * pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Reporte — A-01 SIAF (todos los insumos)
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {siafUnicos.toLocaleString("es-GT")} solicitud{siafUnicos === 1 ? "" : "es"} A-01 SIAF ·{" "}
            {filtered.length.toLocaleString("es-GT")} de {filas.length.toLocaleString("es-GT")} insumos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Buscar por insumo, PPR/código, subproducto, No. SIAF…"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
            />
          </div>
          <div className="relative">
            <select
              className="input pl-3 pr-7 appearance-none"
              value={anioFiltro ?? ""}
              onChange={e => { setAnioFiltro(e.target.value === "" ? null : Number(e.target.value)); setPage(1); }}
            >
              <option value="">Todos los años</option>
              {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              className="input pl-3 pr-7 appearance-none"
              value={estadoFiltro ?? ""}
              onChange={e => { setEstadoFiltro(e.target.value === "" ? null : e.target.value); setPage(1); }}
            >
              <option value="">Todos los estados</option>
              {estados.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          <Link href="/reportes/compras/a01-siaf/imprimir" className="btn-secondary shrink-0" title="Ver versión para imprimir / guardar como PDF">
            <Printer className="w-4 h-4" /> Imprimir / PDF
          </Link>
          <a href="/api/reportes/compras/a01-siaf" className="btn-primary shrink-0" title="Descargar en Excel">
            <Download className="w-4 h-4" /> Exportar Excel
          </a>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-xs">
            <thead>
              <tr className="table-header sticky top-0 bg-white z-10 shadow-sm">
                {["No. SIAF", "Fecha", "Estado", "Insumo", "Subproducto", "Renglón", "PPR / Código", "Cantidad", "Características PPR", "Presentación"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map(f => (
                <tr key={f.item_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{f.siaf_numero}/{f.siaf_anio}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fechaCorta(f.siaf_fecha)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${ESTADO_COLOR[f.siaf_estado] ?? "bg-gray-100 text-gray-700"}`}>
                      {f.siaf_estado}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-900 min-w-[260px] max-w-[360px]">
                    <p className="line-clamp-2">{f.insumo}</p>
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap font-mono max-w-[140px] truncate" title={f.subproducto}>{f.subproducto}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-gray-600 whitespace-nowrap">{f.renglon ?? "—"}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">
                    {f.es_ppr
                      ? <span className="text-green-700">{f.codigo_o_ppr}</span>
                      : <span className="text-gray-500">{f.codigo_o_ppr}</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">
                    {f.cantidad.toLocaleString("es-GT")}
                  </td>
                  <td className="px-3 py-2 text-gray-600 max-w-[280px]">
                    <p className="line-clamp-2">{f.caracteristicas ?? "—"}</p>
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{f.presentacion ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No se encontraron insumos con ese criterio.</p>
            </div>
          )}
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Mostrar</span>
              <div className="relative">
                <select
                  className="input py-1 pl-2 pr-7 text-xs appearance-none"
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                >
                  {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
              <span>por página</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>Página <strong className="text-gray-700">{pageClamped}</strong> de {totalPages}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={pageClamped <= 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={pageClamped >= totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
