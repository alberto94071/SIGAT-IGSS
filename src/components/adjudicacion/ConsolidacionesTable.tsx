"use client";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Gavel, Search, XCircle } from "lucide-react";
import type { Consolidacion } from "@/lib/adjudicacion/types";

export const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ESTADO_COLOR: Record<string, string> = {
  "Pendiente adjudicación":   "bg-amber-100 text-amber-700",
  "Enviado a Junta":          "bg-cyan-100 text-cyan-700",
  "Adjudicado":               "bg-blue-100 text-blue-700",
  "Rechazado por Junta":      "bg-red-100 text-red-700",
  "Enviado a Fondo Rotativo": "bg-purple-100 text-purple-700",
  "Enviado a Presupuesto":    "bg-indigo-100 text-indigo-700",
  "Orden de Compra Generada": "bg-green-100 text-green-700",
};

export const TIPO_COLOR: Record<string, string> = {
  "Compra Directa":     "bg-blue-100 text-blue-700",
  "Baja Cuantía":       "bg-emerald-100 text-emerald-700",
  "Contrato Abierto":   "bg-amber-100 text-amber-700",
  "Casos de Excepción": "bg-orange-100 text-orange-700",
};

export function correlativo(c: Consolidacion) {
  if (c.numero_adjudicacion) return `ADJ-${c.numero_adjudicacion}`;
  if (c.pre_orden) return `PRE-${c.pre_orden}`;
  return `${String(c.numero).padStart(3, "0")}/${c.anio}`;
}

interface Props {
  consolidaciones: Consolidacion[];
  acciones: (c: Consolidacion) => React.ReactNode;
  onVerMotivo?: (c: Consolidacion) => void;
  emptyLabel?: string;
}

export default function ConsolidacionesTable({ consolidaciones, acciones, onVerMotivo, emptyLabel }: Props) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const q = query.toLowerCase().trim();
  const filtered = !q ? consolidaciones : consolidaciones.filter(c =>
    correlativo(c).toLowerCase().includes(q) ||
    c.fecha.includes(q) ||
    (c.tipo_compra ?? "").toLowerCase().includes(q) ||
    (c.pre_orden ?? "").includes(q) ||
    (c.numero_adjudicacion ?? "").includes(q) ||
    c.siaf.some(s => `${s.numero}/${s.anio}`.includes(q))
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por Pre Orden, Adj, tipo o SIAF…"
          value={query} onChange={e => setQuery(e.target.value)} />
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
                <th className="px-4 py-3 text-center whitespace-nowrap">SIAFs</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const expanded = expandedId === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(p => p === c.id ? null : c.id)}>
                      <td className="px-4 py-3 text-gray-400">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                        {correlativo(c)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {c.tipo_compra
                          ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLOR[c.tipo_compra] ?? "bg-gray-100 text-gray-600"}`}>{c.tipo_compra}</span>
                          : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.fecha}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">{c.siaf.length}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap max-w-[180px] truncate">
                        {c.proveedor_nombre ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">
                        {c.total != null ? Q(c.total) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {c.estado === "Rechazado por Junta" && onVerMotivo ? (
                          <button onClick={() => onVerMotivo(c)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                            title="Ver motivo del rechazo">
                            <XCircle className="w-3 h-3" /> Rechazado por Junta
                          </button>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${ESTADO_COLOR[c.estado] ?? "bg-gray-100 text-gray-600"}`}>
                            {c.estado}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {acciones(c)}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-purple-50/30">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5" /> SIAFs consolidados
                              </p>
                              <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead><tr className="bg-gray-100">
                                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Correlativo</th>
                                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Fecha</th>
                                    <th className="px-3 py-1.5 text-center font-semibold text-gray-600">Estado</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-gray-100 bg-white">
                                    {c.siaf.map(s => (
                                      <tr key={s.id}>
                                        <td className="px-3 py-2 font-mono font-bold text-gray-900">{s.numero}/{s.anio}</td>
                                        <td className="px-3 py-2 text-gray-600">{s.fecha}</td>
                                        <td className="px-3 py-2 text-center">
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">{s.estado}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Gavel className="w-3.5 h-3.5" /> Oferentes
                              </p>
                              {c.oferentes.length > 0 ? (
                                <div className="rounded-xl border border-gray-200 overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead><tr className="bg-gray-100">
                                      <th className="px-3 py-1.5 text-left font-semibold text-gray-600">NIT</th>
                                      <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Nombre</th>
                                      <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Costo</th>
                                      <th className="px-3 py-1.5 text-center font-semibold text-gray-600">IVA</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                      {c.oferentes.map(o => (
                                        <tr key={o.id} className={o.id === c.oferente_ganador_id ? "bg-green-50" : ""}>
                                          <td className="px-3 py-2 font-mono text-gray-700">{o.nit}</td>
                                          <td className="px-3 py-2 text-gray-900 font-medium">
                                            {o.nombre}
                                            {o.id === c.oferente_ganador_id && <span className="ml-1.5 text-[10px] text-green-700 font-semibold">GANADOR</span>}
                                          </td>
                                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">{Q(o.costo)}</td>
                                          <td className="px-3 py-2 text-center text-gray-500">{o.exento_iva ? "Exento" : "12%"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : c.precios.length > 0 ? (
                                <div className="rounded-xl border border-gray-200 overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead><tr className="bg-gray-100">
                                      <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Insumo</th>
                                      <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Cant.</th>
                                      <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Precio</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                      {c.precios.map((p, i) => (
                                        <tr key={i}>
                                          <td className="px-3 py-2 text-gray-900 font-medium">{p.nombre}</td>
                                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">{p.cantidad.toLocaleString("es-GT")}</td>
                                          <td className="px-3 py-2 text-right tabular-nums text-gray-700">{p.precio_unitario != null ? Q(p.precio_unitario) : "—"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400">Sin oferentes registrados aún</p>
                              )}
                              <div className="mt-3 space-y-1 text-xs text-gray-600">
                                {c.nog && <p><span className="font-semibold">NOG:</span> {c.nog}</p>}
                                {c.fecha_evento && <p><span className="font-semibold">Fecha evento:</span> {c.fecha_evento}</p>}
                                {c.referencia && <p><span className="font-semibold">Referencia:</span> {c.referencia}</p>}
                                {c.numero_adjudicacion && <p><span className="font-semibold">N° Adjudicación:</span> {c.numero_adjudicacion}</p>}
                                {c.proveedor_nombre && <p><span className="font-semibold">Proveedor:</span> {c.proveedor_nombre} {c.proveedor_nit && `· NIT: ${c.proveedor_nit}`}</p>}
                                {c.regularizado !== null && <p><span className="font-semibold">Tipo:</span> {c.regularizado ? "Regularizado" : "Normal"}</p>}
                                {c.numero_cheque && <p><span className="font-semibold">N° Cheque:</span> {c.numero_cheque}</p>}
                              </div>
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
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Gavel className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{emptyLabel ?? "No hay consolidaciones."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
