"use client";
import { Fragment, useState, useMemo } from "react";
import { Gavel, ChevronDown, ChevronRight, Search, FileText } from "lucide-react";

type SiafResumen = {
  id: number; numero: number; anio: number; fecha: string;
  consolidacion_id: number | null;
};
type Consolidacion = {
  id: number; numero: number; anio: number; fecha: string;
  creado_por: number | null; created_at: string | null;
  siaf: SiafResumen[];
};

export default function AdjudicacionClient({ consolidaciones: init }: { consolidaciones: Consolidacion[] }) {
  const [consolidaciones] = useState(init);
  const [query,       setQuery]       = useState("");
  const [expandedId,  setExpandedId]  = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return consolidaciones;
    return consolidaciones.filter(c =>
      `${c.numero}/${c.anio}`.includes(q) ||
      c.fecha.includes(q) ||
      c.siaf.some(s => `${s.numero}/${s.anio}`.includes(q))
    );
  }, [consolidaciones, query]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Gavel className="w-5 h-5" /> Adjudicaciones
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {consolidaciones.length} consolidación(es) registrada(s)
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por correlativo o SIAF…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Correlativo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">SIAFs</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const expanded = expandedId === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(p => p === c.id ? null : c.id)}>
                      <td className="px-4 py-3 text-gray-400">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                        ADJ-{String(c.numero).padStart(3, "0")}/{c.anio}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.fecha}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                          {c.siaf.length}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                          Pendiente adjudicación
                        </span>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-purple-50/30">
                        <td colSpan={5} className="px-6 py-4">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5" />
                            SIAFs consolidados en ADJ-{String(c.numero).padStart(3, "0")}/{c.anio}
                          </p>
                          {c.siaf.length === 0 ? (
                            <p className="text-sm text-gray-400">Sin solicitudes vinculadas</p>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Correlativo SIAF</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Fecha</th>
                                    <th className="px-3 py-2 text-center font-semibold text-gray-600 whitespace-nowrap">Estado</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                  {c.siaf.map(s => (
                                    <tr key={s.id}>
                                      <td className="px-3 py-2 font-mono font-bold text-gray-900 whitespace-nowrap">
                                        {s.numero}/{s.anio}
                                      </td>
                                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{s.fecha}</td>
                                      <td className="px-3 py-2 text-center">
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
                                          Consolidado
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Gavel className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay consolidaciones aún. Ve a A-01 SIAF, selecciona solicitudes aprobadas y consolídalas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
