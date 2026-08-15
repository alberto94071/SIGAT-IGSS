"use client";
import { useState } from "react";
import { FileCheck, X, Loader2, AlertTriangle, Hash, CheckCircle, XCircle } from "lucide-react";
import { registrarCompromiso, aprobarCompromiso, rechazarCompromiso } from "@/lib/adjudicacion/compromiso-actions";
import RenglonBadges from "@/components/RenglonBadges";
import ExpandableRow from "@/components/ExpandableRow";
import TrazabilidadPanel from "@/components/TrazabilidadPanel";
import type { TrazabilidadConsolidacion } from "@/lib/adjudicacion/trazabilidad-utils";

type Orden = {
  id: number; numero: number; anio: number; tipo_compra: string;
  proveedor_nit: string | null; proveedor_nombre: string | null;
  total: number | null; codigo_ppr: string | null; no_compromiso: string | null;
  renglones: { renglon: number | null; subproducto: string; nombre: string; cantidad: number }[];
  traz: TrazabilidadConsolidacion | null;
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CompromisoClient({ ordenes: init, solicitadas: initSolicitadas }: { ordenes: Orden[]; solicitadas: Orden[] }) {
  const [ordenes, setOrdenes] = useState(init);
  const [solicitadas, setSolicitadas] = useState(initSolicitadas);
  const [comprometerFor, setComprometerFor] = useState<Orden | null>(null);
  const [acciones, setAcciones] = useState<Record<number, { cargando: boolean; error: string | null }>>({});
  const [expandedOrden, setExpandedOrden] = useState<number | null>(null);
  const [expandedSolicitada, setExpandedSolicitada] = useState<number | null>(null);

  const ejecutarAccion = async (id: number, accion: (id: number) => Promise<{ ok: true } | { error: string }>) => {
    setAcciones(prev => ({ ...prev, [id]: { cargando: true, error: null } }));
    const res = await accion(id);
    if ("error" in res) {
      setAcciones(prev => ({ ...prev, [id]: { cargando: false, error: res.error } }));
    } else {
      setAcciones(prev => ({ ...prev, [id]: { cargando: false, error: null } }));
      setSolicitadas(prev => prev.filter(o => o.id !== id));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileCheck className="w-5 h-5" /> Presupuesto — Compromiso
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{ordenes.length} orden(es) pendiente(s) de comprometer</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Orden</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Código PPR</th>
                <th className="px-4 py-3 text-left max-w-xs">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ordenes.map(o => (
                <ExpandableRow key={o.id} colSpan={6}
                  expanded={expandedOrden === o.id}
                  onToggle={() => setExpandedOrden(p => p === o.id ? null : o.id)}
                  rowClassName="hover:bg-gray-50 cursor-pointer transition-colors"
                  detail={<TrazabilidadPanel titulo={`Detalle de OC-${String(o.numero).padStart(3, "0")}`} traz={o.traz} />}>
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                    OC-{String(o.numero).padStart(3, "0")}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{o.codigo_ppr ?? "—"}</td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-gray-900">{o.proveedor_nombre ?? "—"}</p>
                    {o.proveedor_nit && <p className="text-xs text-gray-400">NIT: {o.proveedor_nit}</p>}
                    <RenglonBadges renglones={o.renglones} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                    {o.total != null ? Q(o.total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setComprometerFor(o)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors ml-auto">
                      <FileCheck className="w-3 h-3" /> Comprometer
                    </button>
                  </td>
                </ExpandableRow>
              ))}
            </tbody>
          </table>
          {ordenes.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay órdenes pendientes de comprometer.</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900">Pendientes de aprobación de Compromiso</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {solicitadas.length} orden(es) con No. de Compromiso registrado, esperando aprobación de Presupuesto. Mientras no se apruebe, la orden no avanza a Almacén/Devengado.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Orden</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Compromiso</th>
                <th className="px-4 py-3 text-left max-w-xs">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {solicitadas.map(o => {
                const a = acciones[o.id];
                return (
                  <ExpandableRow key={o.id} colSpan={6}
                    expanded={expandedSolicitada === o.id}
                    onToggle={() => setExpandedSolicitada(p => p === o.id ? null : o.id)}
                    rowClassName="hover:bg-gray-50 cursor-pointer transition-colors"
                    detail={<TrazabilidadPanel
                      titulo={`Detalle de OC-${String(o.numero).padStart(3, "0")}`}
                      cadena={[{ label: "No. Compromiso", value: o.no_compromiso }]}
                      traz={o.traz}
                    />}>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                      OC-{String(o.numero).padStart(3, "0")}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{o.no_compromiso ?? "—"}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium text-gray-900">{o.proveedor_nombre ?? "—"}</p>
                      {o.proveedor_nit && <p className="text-xs text-gray-400">NIT: {o.proveedor_nit}</p>}
                      <RenglonBadges renglones={o.renglones} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                      {o.total != null ? Q(o.total) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => ejecutarAccion(o.id, aprobarCompromiso)}
                          disabled={a?.cargando}
                          title="Aprobar"
                          className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => ejecutarAccion(o.id, rechazarCompromiso)}
                          disabled={a?.cargando}
                          title="Rechazar"
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                      {a?.error && <p className="text-red-600 text-xs mt-1 max-w-[260px] whitespace-normal break-words text-left ml-auto">{a.error}</p>}
                    </td>
                  </ExpandableRow>
                );
              })}
            </tbody>
          </table>
          {solicitadas.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay compromisos pendientes de aprobación.</p>
            </div>
          )}
        </div>
      </div>

      {comprometerFor && (
        <ComprometerModal
          orden={comprometerFor}
          onClose={() => setComprometerFor(null)}
          onDone={(noCompromiso) => {
            setOrdenes(p => p.filter(o => o.id !== comprometerFor.id));
            setSolicitadas(p => [...p, { ...comprometerFor, no_compromiso: noCompromiso }]);
            setComprometerFor(null);
          }}
        />
      )}
    </div>
  );
}

function ComprometerModal({ orden: o, onClose, onDone }: { orden: Orden; onClose: () => void; onDone: (noCompromiso: string) => void }) {
  const [noCompromiso, setNoCompromiso] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleEnviar() {
    if (!noCompromiso.trim()) return setError("El No. de Compromiso es obligatorio");
    setSaving(true); setError("");
    const res = await registrarCompromiso(o.id, noCompromiso.trim());
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onDone(noCompromiso.trim());
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Comprometer — OC-{String(o.numero).padStart(3, "0")}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="label flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> No. de Compromiso</label>
            <input className="input font-mono" value={noCompromiso} onChange={e => setNoCompromiso(e.target.value)} autoFocus />
          </div>
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleEnviar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />} Registrar Compromiso
          </button>
        </div>
      </div>
    </div>
  );
}
