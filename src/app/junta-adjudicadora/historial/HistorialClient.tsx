"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Archive, Printer, Search } from "lucide-react";

type Acta = { id: number; no_formulario: string; no_acta: string; aprobado_en: string | null };
type Consolidacion = {
  id: number; numero: number; anio: number; tipo_compra: string | null;
  numero_adjudicacion: string | null; pre_orden: string | null;
  proveedor_nombre: string | null; proveedor_nit: string | null; total: number | null;
};
type Row = { acta: Acta; consolidacion: Consolidacion };

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function correlativo(c: Consolidacion) {
  if (c.numero_adjudicacion) return `ADJ-${c.numero_adjudicacion}`;
  if (c.pre_orden) return `PRE-${c.pre_orden}`;
  return `${String(c.numero).padStart(3, "0")}/${c.anio}`;
}

export default function HistorialClient({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(({ acta, consolidacion: c }) =>
      correlativo(c).toLowerCase().includes(q) ||
      acta.no_acta.toLowerCase().includes(q) ||
      acta.no_formulario.toLowerCase().includes(q) ||
      (c.proveedor_nombre ?? "").toLowerCase().includes(q) ||
      (c.proveedor_nit ?? "").includes(q)
    );
  }, [rows, query]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Archive className="w-5 h-5" /> Historial de Actas
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {rows.length} acta(s) aprobada(s) · aquí puedes volver a ver o imprimir cualquier acta ya procesada.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por referencia, No. Acta, proveedor…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Referencia</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Tipo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Acta</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Aprobada</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(({ acta, consolidacion: c }) => (
                <tr key={acta.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{correlativo(c)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{c.tipo_compra ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{acta.no_acta}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    <p className="font-medium">{c.proveedor_nombre ?? "—"}</p>
                    {c.proveedor_nit && <p className="text-gray-400">NIT: {c.proveedor_nit}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">
                    {c.total != null ? Q(c.total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{acta.aprobado_en ?? "—"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/junta-adjudicadora/acta/${acta.id}/imprimir`} target="_blank"
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors w-fit ml-auto">
                      <Printer className="w-3 h-3" /> Ver / Imprimir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{rows.length === 0 ? "Aún no hay actas aprobadas." : "Sin resultados para esa búsqueda."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
