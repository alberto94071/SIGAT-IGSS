"use client";
import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ShoppingCart, Loader2, CheckCircle2, Printer } from "lucide-react";
import { generarOrdenDesdeDestino } from "@/lib/adjudicacion/actions";
import type { Consolidacion } from "@/lib/adjudicacion/types";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props { consolidaciones: Consolidacion[]; titulo: string; }

export default function BandejaDestino({ consolidaciones: init, titulo }: Props) {
  const [consolidaciones, setConsolidaciones] = useState(init);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [generando,  setGenerando]  = useState<number | null>(null);
  const [error,      setError]      = useState<Record<number, string>>({});

  async function handleGenerar(id: number) {
    setGenerando(id); setError(prev => ({ ...prev, [id]: "" }));
    const res = await generarOrdenDesdeDestino(id);
    setGenerando(null);
    if (res.error) { setError(prev => ({ ...prev, [id]: res.error! })); return; }
    setConsolidaciones(p => p.filter(c => c.id !== id));
  }

  if (consolidaciones.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-lg mx-auto mt-10">
        <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Sin órdenes pendientes</h2>
        <p className="text-sm text-gray-500">No hay consolidaciones adjudicadas esperando en {titulo}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" /> {titulo}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{consolidaciones.length} orden(es) adjudicada(s) pendiente(s) de generar</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Referencia</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Tipo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {consolidaciones.map(c => {
                const expanded = expandedId === c.id;
                const ref = c.numero_adjudicacion ? `ADJ-${c.numero_adjudicacion}` : c.pre_orden ? `PRE-${c.pre_orden}` : `${c.numero}/${c.anio}`;
                return (
                  <Fragment key={c.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(p => p === c.id ? null : c.id)}>
                      <td className="px-4 py-3 text-gray-400">{expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{ref}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{c.tipo_compra ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.fecha}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        <p className="font-medium">{c.proveedor_nombre ?? "—"}</p>
                        {c.proveedor_nit && <p className="text-gray-400">NIT: {c.proveedor_nit}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                        {c.total != null ? Q(c.total) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-end gap-1">
                          <button onClick={() => handleGenerar(c.id)} disabled={generando === c.id}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                            {generando === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingCart className="w-3 h-3" />}
                            Generar Orden
                          </button>
                          {c.numero_a04 && (
                            <Link href={`/compras/adjudicacion/${c.id}/imprimir-a04`} target="_blank"
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                              <Printer className="w-3 h-3" /> Imprimir A-04
                            </Link>
                          )}
                          {error[c.id] && <p className="text-[10px] text-red-600">{error[c.id]}</p>}
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-green-50/30">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Detalle insumos y precios (o proveedor ganador, si viene de la comparación de oferentes) */}
                            <div>
                              {c.precios.length > 0 ? (
                                <>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Insumos y precios</p>
                                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead><tr className="bg-gray-100">
                                        <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Insumo</th>
                                        <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Renglón</th>
                                        <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Cant.</th>
                                        <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Precio</th>
                                        <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Subtotal</th>
                                      </tr></thead>
                                      <tbody className="divide-y divide-gray-100 bg-white">
                                        {c.precios.map((p, i) => (
                                          <tr key={i}>
                                            <td className="px-3 py-2 font-medium text-gray-900">{p.nombre}<span className="block text-gray-400 font-mono text-[10px]">{p.subproducto}</span></td>
                                            <td className="px-3 py-2 tabular-nums text-gray-600">{p.renglon ?? "—"}</td>
                                            <td className="px-3 py-2 text-right tabular-nums text-gray-600">{p.cantidad.toLocaleString("es-GT")}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{p.precio_unitario != null ? Q(p.precio_unitario) : "—"}</td>
                                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">{p.precio_unitario != null ? Q(p.cantidad * p.precio_unitario) : "—"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Proveedor ganador</p>
                                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                                    <p className="text-sm font-medium text-gray-900">{c.proveedor_nombre ?? "—"}</p>
                                    {c.proveedor_nit && <p className="text-xs text-gray-400">NIT: {c.proveedor_nit}</p>}
                                    <p className="text-sm font-bold text-green-700 mt-1">{c.total != null ? Q(c.total) : "—"}</p>
                                  </div>
                                </>
                              )}
                            </div>
                            {/* Datos adicionales */}
                            <div className="space-y-1 text-xs text-gray-600">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Datos</p>
                              {c.numero_a04 && <p><span className="font-semibold">N° A-04 SIAF:</span> {c.numero_a04}/{c.anio_a04}</p>}
                              {c.referencia && <p><span className="font-semibold">Referencia:</span> {c.referencia}</p>}
                              {c.nog && <p><span className="font-semibold">NOG:</span> {c.nog}</p>}
                              {c.fecha_evento && <p><span className="font-semibold">Fecha evento:</span> {c.fecha_evento}</p>}
                              <p><span className="font-semibold">IVA:</span> {c.exento_iva ? "Exento" : "Con descuento 12%"}</p>
                              {c.regularizado !== null && <p><span className="font-semibold">Tipo gasto:</span> {c.regularizado ? "Regularizado" : "Normal"}</p>}
                              <p><span className="font-semibold">SIAFs:</span> {c.siaf.map(s => `${s.numero}/${s.anio}`).join(", ")}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
