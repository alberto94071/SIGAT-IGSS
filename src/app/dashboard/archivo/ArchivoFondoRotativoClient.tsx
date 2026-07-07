"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Archive, Search, Printer } from "lucide-react";
import type { PagoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ESTADO_STYLE: Record<string, string> = {
  "Pendiente forma de pago":      "bg-amber-100 text-amber-700",
  "Enviado a Bancos":             "bg-blue-100 text-blue-700",
  "Enviado a Libro Caja Chica":   "bg-green-100 text-green-700",
};

interface Props { pagos: PagoFondoRotativo[]; }

export default function ArchivoFondoRotativoClient({ pagos }: Props) {
  const [query, setQuery] = useState("");

  const q = query.toLowerCase().trim();
  const filtered = useMemo(() => !q ? pagos : pagos.filter(p =>
    (p.numero_a04 != null && `${p.numero_a04}/${p.anio_a04}`.includes(q)) ||
    (p.destinatario_nombre ?? "").toLowerCase().includes(q) ||
    `${p.serie_factura}-${p.no_factura}`.toLowerCase().includes(q)
  ), [pagos, q]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Archive className="w-5 h-5" /> Fondo Rotativo — Archivo
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Todo lo que ya generó su SIAF-04 queda aquí para siempre — {pagos.length} registro(s) en total.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por No. A-04, proveedor, factura…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">No. A-04 SIAF</th>
                <th className="px-4 py-3 text-left">Destinatario</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Factura</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Etapa</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                    {p.numero_a04 != null ? `${p.numero_a04}/${p.anio_a04}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.destinatario_nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {p.serie_factura}-{p.no_factura} · {p.fecha_emision_factura}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_STYLE[p.estado] ?? "bg-gray-100 text-gray-600"}`}>
                      {p.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                    {p.total != null ? Q(p.total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/compras/adjudicacion/${p.consolidacion_id}/imprimir-a04`} target="_blank"
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors ml-auto">
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
              <p className="text-sm">{pagos.length === 0 ? "Aún no se ha generado ningún SIAF-04." : "Sin resultados para esa búsqueda."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
