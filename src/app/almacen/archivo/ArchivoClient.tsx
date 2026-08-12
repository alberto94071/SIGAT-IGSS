"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Archive, Search, Printer, Loader2 } from "lucide-react";
import RenglonBadges from "@/components/RenglonBadges";
import { getOrdenesArchivadasAlmacen } from "@/lib/adjudicacion/dab60-actions";

type Orden = {
  id: number; numero: number; anio: number;
  proveedor_nit: string | null; proveedor_nombre: string | null;
  total: number | null; estado: string;
  dab60_generado_en: string | null; dab60_anulado: boolean;
  no_factura: string | null; serie_factura: string | null; fecha_emision: string | null;
  lote: string | null; fecha_vencimiento: string | null;
  marca: string | null; modelo: string | null; serie: string | null; no_devengado: string | null;
  renglones: { renglon: number | null; subproducto: string; nombre: string; cantidad: number }[];
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ESTADO_STYLE: Record<string, string> = {
  "DAB-60 Pendiente Aprobación": "bg-blue-100 text-blue-700",
  "En Devengado":                "bg-amber-100 text-amber-700",
  "Completada":                  "bg-green-100 text-green-700",
  "Anulada":                     "bg-red-100 text-red-700",
};

export default function ArchivoClient({ ordenes: ordenesIniciales, hasMore: hasMoreInicial }: { ordenes: Orden[]; hasMore: boolean }) {
  const [ordenes, setOrdenes] = useState(ordenesIniciales);
  const [hasMore, setHasMore] = useState(hasMoreInicial);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [query, setQuery] = useState("");

  const q = query.toLowerCase().trim();
  const filtered = useMemo(() => !q ? ordenes : ordenes.filter(o =>
    `${o.numero}/${o.anio}`.includes(q) ||
    (o.proveedor_nombre ?? "").toLowerCase().includes(q) ||
    (o.no_factura ?? "").toLowerCase().includes(q) ||
    (o.no_devengado ?? "").toLowerCase().includes(q) ||
    o.renglones.some(r => r.nombre.toLowerCase().includes(q))
  ), [ordenes, q]);

  async function cargarMas() {
    setCargandoMas(true);
    try {
      const { ordenes: siguientes, hasMore: quedaMas } = await getOrdenesArchivadasAlmacen(ordenes.length);
      setOrdenes(p => [...p, ...siguientes]);
      setHasMore(quedaMas);
    } finally {
      setCargandoMas(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Archive className="w-5 h-5" /> Almacén — Archivo
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Historial de órdenes que ya pasaron por DAB-60 ({ordenes.length}{hasMore ? "+" : ""}).
        </p>
      </div>

      <div>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Buscar por orden, proveedor, factura, No. Devengado o insumo…"
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {hasMore && (
          <p className="text-xs text-gray-400 mt-1">
            La búsqueda solo alcanza lo ya cargado — usa &quot;Cargar más&quot; para traer órdenes anteriores.
          </p>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Orden</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha DAB-60</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Factura / Lote</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Marca / Modelo / Serie</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                    OC-{String(o.numero).padStart(3, "0")}/{o.anio}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{o.dab60_generado_en ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{o.proveedor_nombre ?? "—"}</p>
                    {o.proveedor_nit && <p className="text-xs text-gray-400">NIT: {o.proveedor_nit}</p>}
                    <RenglonBadges renglones={o.renglones} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <p>{o.no_factura ?? "—"} {o.serie_factura ? `· ${o.serie_factura}` : ""}</p>
                    <p className="text-xs text-gray-400">Lote: {o.lote ?? "—"} · Vence: {o.fecha_vencimiento ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <p>{o.marca ?? "—"} {o.modelo ? `/ ${o.modelo}` : ""}</p>
                    <p className="text-xs text-gray-400">Serie: {o.serie ?? "—"} · No. Devengado: {o.no_devengado ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                    {o.total != null ? Q(o.total) : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_STYLE[o.estado] ?? "bg-gray-100 text-gray-600"}`}>
                      {o.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {o.dab60_anulado ? (
                      <span className="text-xs text-gray-400">DAB-60 anulado</span>
                    ) : (
                      <Link href={`/almacen/dab-60/${o.id}/imprimir`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                        <Printer className="w-3 h-3" /> Imprimir
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay órdenes archivadas todavía.</p>
            </div>
          )}
        </div>
        {hasMore && (
          <div className="flex justify-center py-4 border-t border-gray-100">
            <button onClick={cargarMas} disabled={cargandoMas}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50">
              {cargandoMas ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {cargandoMas ? "Cargando…" : "Cargar más"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
