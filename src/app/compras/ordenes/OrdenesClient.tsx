"use client";
import { useState } from "react";
import {
  ShoppingCart, Search, X, Loader2, AlertTriangle, Hash, Calendar, Building2, DollarSign, Send,
} from "lucide-react";
import { generarOrdenDeCompra, enviarOrdenAPresupuesto, type ConsolidacionPendienteOrden } from "@/lib/adjudicacion/ordenes-actions";
import RenglonBadges from "@/components/RenglonBadges";
import { useRouter } from "next/navigation";

type OrdenGenerada = {
  id: number; numero: number; anio: number; fecha: string;
  consolidacion_id: number; tipo_compra: string;
  nog: string | null; referencia: string | null;
  proveedor_nit: string | null; proveedor_nombre: string | null;
  costo_unitario: number | null; total_cantidad: number | null;
  exento_iva: boolean; total: number | null; estado: string;
  codigo_ppr: string | null; fecha_notificacion_proveedor: string | null;
  renglones: { renglon: number | null; subproducto: string; nombre: string; cantidad: number }[];
};

const TIPO_COLOR: Record<string, string> = {
  "Compra Directa":    "bg-blue-100 text-blue-700",
  "Baja Cuantía":      "bg-emerald-100 text-emerald-700",
  "Contrato Abierto":  "bg-amber-100 text-amber-700",
  "Casos de Excepción": "bg-orange-100 text-orange-700",
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function correlativo(c: { numero: number; anio: number; numero_adjudicacion: string | null; pre_orden: string | null }) {
  if (c.numero_adjudicacion) return `ADJ-${c.numero_adjudicacion}`;
  if (c.pre_orden) return `PRE-${c.pre_orden}`;
  return `${String(c.numero).padStart(3, "0")}/${c.anio}`;
}

export default function OrdenesClient({ pendientes: initP, enProceso: initE }: {
  pendientes: ConsolidacionPendienteOrden[]; enProceso: OrdenGenerada[];
}) {
  const [pendientes, setPendientes] = useState(initP);
  const [enProceso,  setEnProceso]  = useState(initE);
  const [query, setQuery] = useState("");
  const [generarFor, setGenerarFor] = useState<ConsolidacionPendienteOrden | null>(null);
  const [enviando, setEnviando] = useState<number | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});
  const router = useRouter();

  const q = query.toLowerCase().trim();
  const pendientesF = !q ? pendientes : pendientes.filter(c =>
    correlativo(c).toLowerCase().includes(q) ||
    (c.proveedor_nombre ?? "").toLowerCase().includes(q) ||
    (c.nog ?? "").includes(q));
  const enProcesoF = !q ? enProceso : enProceso.filter(o =>
    `OC-${String(o.numero).padStart(3, "0")}/${o.anio}`.includes(q) ||
    (o.proveedor_nombre ?? "").toLowerCase().includes(q) ||
    (o.nog ?? "").includes(q));

  async function handleEnviar(o: OrdenGenerada) {
    setEnviando(o.id); setRowError(p => ({ ...p, [o.id]: "" }));
    const res = await enviarOrdenAPresupuesto(o.id);
    setEnviando(null);
    if ("error" in res) { setRowError(p => ({ ...p, [o.id]: res.error })); return; }
    setEnProceso(p => p.filter(x => x.id !== o.id));
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" /> Órdenes de Compra
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {pendientes.length} por generar · {enProceso.length} por enviar a Presupuesto
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por correlativo, proveedor, NOG…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      {/* Pendientes de generar orden */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Adjudicadas — pendientes de generar orden</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left whitespace-nowrap">Referencia</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Tipo</th>
                  <th className="px-4 py-3 text-left">Proveedor</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendientesF.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{correlativo(c)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLOR[c.tipo_compra ?? ""] ?? "bg-gray-100 text-gray-600"}`}>{c.tipo_compra ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.proveedor_nombre ?? "—"}</p>
                      {c.proveedor_nit && <p className="text-xs text-gray-400">NIT: {c.proveedor_nit}</p>}
                      <RenglonBadges renglones={c.renglones} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                      {c.total != null ? Q(c.total) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setGenerarFor(c)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors ml-auto">
                        <ShoppingCart className="w-3 h-3" /> Generar Orden de Compra
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pendientesF.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">{pendientes.length === 0 ? "No hay adjudicaciones pendientes de generar orden." : "Sin resultados."}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Generadas, pendientes de enviar a Presupuesto */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Órdenes generadas — pendientes de enviar a Presupuesto</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left whitespace-nowrap">Orden</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Código PPR</th>
                  <th className="px-4 py-3 text-left">Proveedor</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">P. Unitario</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enProcesoF.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                      OC-{String(o.numero).padStart(3, "0")}/{o.anio}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{o.codigo_ppr ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{o.proveedor_nombre ?? "—"}</p>
                      {o.proveedor_nit && <p className="text-xs text-gray-400">NIT: {o.proveedor_nit}</p>}
                      <RenglonBadges renglones={o.renglones} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700 whitespace-nowrap">
                      {o.costo_unitario != null ? Q(o.costo_unitario) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                      {o.total != null ? Q(o.total) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex flex-col items-end gap-1">
                        <button onClick={() => handleEnviar(o)} disabled={enviando === o.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          {enviando === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Enviar a Presupuesto
                        </button>
                        {rowError[o.id] && <p className="text-[10px] text-red-600 max-w-[160px] text-right">{rowError[o.id]}</p>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {enProcesoF.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">{enProceso.length === 0 ? "No hay órdenes pendientes de enviar a Presupuesto." : "Sin resultados."}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {generarFor && (
        <GenerarOrdenModal
          consolidacion={generarFor}
          onClose={() => setGenerarFor(null)}
          onGenerada={() => { setGenerarFor(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function GenerarOrdenModal({ consolidacion: c, onClose, onGenerada }: {
  consolidacion: ConsolidacionPendienteOrden; onClose: () => void; onGenerada: () => void;
}) {
  const [codigoPpr, setCodigoPpr] = useState("");
  const [numeroOrden, setNumeroOrden] = useState("");
  const [fechaNotificacion, setFechaNotificacion] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalCantidad = c.renglones.reduce((s, r) => s + r.cantidad, 0);
  const precioUnitarioPreview = totalCantidad > 0 && c.total != null ? c.total / totalCantidad : null;

  async function handleGuardar() {
    if (!codigoPpr.trim()) return setError("El Código PPR es obligatorio");
    if (!numeroOrden.trim()) return setError("El número de orden de compra es obligatorio");
    if (!fechaNotificacion) return setError("La fecha de notificación al proveedor es obligatoria");
    setSaving(true); setError("");
    const res = await generarOrdenDeCompra(c.id, {
      codigo_ppr: codigoPpr.trim(),
      numero_orden: numeroOrden.trim(), fecha_notificacion: fechaNotificacion,
    });
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onGenerada();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Generar Orden de Compra — {correlativo(c)}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 space-y-1.5 text-sm">
            <p className="flex items-center gap-1.5 text-gray-700">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              <strong>{c.proveedor_nombre ?? "—"}</strong> {c.proveedor_nit && <span className="text-gray-400">· NIT: {c.proveedor_nit}</span>}
            </p>
            {c.nog && (
              <p className="flex items-center gap-1.5 text-gray-700">
                <Hash className="w-3.5 h-3.5 text-gray-400" /> NOG: <span className="font-mono">{c.nog}</span>
              </p>
            )}
            <div className="pt-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Renglón del insumo</p>
              {c.renglones.length > 0 ? c.renglones.map((r, i) => (
                <p key={i} className="text-xs text-gray-600">
                  {r.renglon != null ? `Renglón ${r.renglon}` : "Renglón —"} · {r.subproducto} — {r.nombre} ({r.cantidad.toLocaleString("es-GT")})
                </p>
              )) : <p className="text-xs text-gray-400">Sin renglón identificado</p>}
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Precio Unitario</label>
            <div className="input bg-gray-50 text-gray-700 flex items-center justify-between">
              <span>{precioUnitarioPreview != null ? Q(precioUnitarioPreview) : "—"}</span>
              <span className="text-xs text-gray-400">Tomado de la cotización</span>
            </div>
          </div>
          <div>
            <label className="label">Código PPR</label>
            <input className="input font-mono" value={codigoPpr} onChange={e => setCodigoPpr(e.target.value)} />
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Número de Orden de Compra</label>
            <input className="input font-mono" value={numeroOrden} onChange={e => setNumeroOrden(e.target.value)} />
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Fecha de notificación al proveedor</label>
            <input type="date" className="input" value={fechaNotificacion} onChange={e => setFechaNotificacion(e.target.value)} />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />} Generar
          </button>
        </div>
      </div>
    </div>
  );
}
