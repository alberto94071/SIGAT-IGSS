"use client";
import { Fragment, useState, useMemo } from "react";
import {
  Layers, ChevronDown, ChevronRight, Search, X, Loader2, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";
import { consolidarSiaf, rechazarSolicitud } from "../a01-siaf/actions";

type SolicitudItem = {
  id: number; codigo_igss: string | null; nombre: string; subproducto: string; cantidad_solicitada: number; renglon: number | null;
};
type Solicitud = {
  id: number; numero: number; anio: number; fecha: string; estado: string;
  observaciones: string | null;
  items: SolicitudItem[];
};

interface Props { solicitudes: Solicitud[]; canEdit: boolean; }

export default function ConsolidacionClient({ solicitudes: init, canEdit }: Props) {
  const [solicitudes, setSolicitudes] = useState(init);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [consolModal, setConsolModal] = useState(false);
  const [consolLoading, setConsolLoading] = useState(false);
  const [consolError, setConsolError] = useState("");
  const [preOrden, setPreOrden] = useState("");

  const [rechazarModal, setRechazarModal] = useState(false);
  const [rechazarSolId, setRechazarSolId] = useState<number | null>(null);
  const [rechazarMotivo, setRechazarMotivo] = useState("");
  const [rechazarLoading, setRechazarLoading] = useState(false);
  const [rechazarError, setRechazarError] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return solicitudes;
    const q = query.toLowerCase();
    return solicitudes.filter(s =>
      `${s.numero}/${s.anio}`.includes(q) ||
      s.fecha.includes(q) ||
      s.items.some(i => i.nombre.toLowerCase().includes(q))
    );
  }, [solicitudes, query]);

  const seleccionadosList = useMemo(() =>
    solicitudes.filter(s => seleccionados.has(s.id)),
    [solicitudes, seleccionados]
  );

  function toggleSeleccion(id: number) {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleConsolidar() {
    if (seleccionados.size === 0) return;
    if (!/^[A-Za-z0-9]+$/.test(preOrden.trim())) {
      setConsolError("Ingresa un Número de Pre Orden válido (solo letras y números)");
      return;
    }
    setConsolLoading(true);
    setConsolError("");
    const res = await consolidarSiaf([...seleccionados], preOrden.trim());
    setConsolLoading(false);
    if (res.error) { setConsolError(res.error); return; }
    // Las solicitudes consolidadas "salen" de esta pantalla — ya siguen su
    // curso desde /compras/adjudicacion.
    setSolicitudes(p => p.filter(s => !seleccionados.has(s.id)));
    setSeleccionados(new Set());
    setConsolModal(false);
    setPreOrden("");
  }

  function openRechazar(id: number) {
    setRechazarSolId(id); setRechazarMotivo(""); setRechazarError(""); setRechazarModal(true);
  }

  async function confirmRechazar() {
    if (!rechazarSolId) return;
    const motivo = rechazarMotivo.trim();
    if (!motivo) { setRechazarError("El motivo del rechazo es obligatorio"); return; }
    setRechazarLoading(true);
    setRechazarError("");
    const res = await rechazarSolicitud(rechazarSolId, motivo);
    setRechazarLoading(false);
    if (res.error) { setRechazarError(res.error); return; }
    setSolicitudes(p => p.filter(s => s.id !== rechazarSolId));
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.delete(rechazarSolId);
      return next;
    });
    setRechazarModal(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5" /> Consolidación
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {solicitudes.length} SIAF(s) aprobado(s) esperando consolidarse
          </p>
        </div>
        {canEdit && seleccionados.size > 0 && (
          <button
            onClick={() => { setConsolError(""); setPreOrden(""); setConsolModal(true); }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm">
            <Layers className="w-4 h-4" />
            Consolidar ({seleccionados.size})
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por correlativo, insumo…"
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
                <th className="px-4 py-3 text-center whitespace-nowrap">Ítems</th>
                {canEdit && <th className="px-4 py-3 text-center whitespace-nowrap">Acciones</th>}
                {canEdit && <th className="px-4 py-3 text-center whitespace-nowrap w-12">Sel.</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const expanded = expandedId === s.id;
                const isSelected = seleccionados.has(s.id);
                return (
                  <Fragment key={s.id}>
                    <tr
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${isSelected ? "bg-purple-50 hover:bg-purple-100" : "hover:bg-gray-50"}`}
                      onClick={() => setExpandedId(p => p === s.id ? null : s.id)}>
                      <td className="px-4 py-3 text-gray-400">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{s.numero}/{s.anio}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.fecha}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                          {s.items.length}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => openRechazar(s.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-red-600 hover:bg-red-50 transition-colors">
                            <XCircle className="w-3.5 h-3.5" /> Rechazar
                          </button>
                        </td>
                      )}
                      {canEdit && (
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSeleccion(s.id)}
                            className="w-4 h-4 accent-purple-600 cursor-pointer" />
                        </td>
                      )}
                    </tr>
                    {expanded && (
                      <tr className="bg-brand-50/40">
                        <td colSpan={canEdit ? 6 : 4} className="px-6 py-4">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Insumos en la solicitud {s.numero}/{s.anio}
                          </p>
                          <div className="overflow-x-auto rounded-xl border border-gray-200">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Código IGSS</th>
                                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Insumo</th>
                                  <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Subproducto</th>
                                  <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Renglón</th>
                                  <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">Cantidad</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {s.items.map(item => (
                                  <tr key={item.id}>
                                    <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{item.codigo_igss ?? "—"}</td>
                                    <td className="px-3 py-2 font-medium text-gray-900">{item.nombre}</td>
                                    <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{item.subproducto}</td>
                                    <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap">{item.renglon ?? "—"}</td>
                                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">
                                      {item.cantidad_solicitada.toLocaleString("es-GT")}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay SIAFs aprobados pendientes de consolidar.</p>
            </div>
          )}
        </div>
      </div>

      {consolModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-600" /> Consolidar solicitudes
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Se creará una nueva consolidación</p>
              </div>
              <button onClick={() => setConsolModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-gray-600">
                Vas a consolidar <strong>{seleccionados.size}</strong> solicitud(es) A-01 SIAF:
              </p>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {seleccionadosList.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span className="font-mono font-bold text-gray-900 text-sm">{s.numero}/{s.anio}</span>
                    <span className="text-xs text-gray-400">{s.fecha}</span>
                    <span className="ml-auto text-xs text-gray-400">{s.items.length} ítem(s)</span>
                  </div>
                ))}
              </div>
              <div>
                <label className="label">Número de Pre Orden <span className="text-red-500 font-semibold">*</span></label>
                <input
                  className="input font-mono"
                  value={preOrden}
                  onChange={e => setPreOrden(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                  placeholder="Ej: 1023 o PO-2026-A"
                  autoFocus
                />
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Al confirmar, estas solicitudes pasarán a estado <strong>Consolidado</strong> y desaparecerán de esta lista.
                Podrás seguirlas desde la Hoja de Ruta.
              </div>
              {consolError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {consolError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setConsolModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleConsolidar} disabled={consolLoading || !/^[A-Za-z0-9]+$/.test(preOrden.trim())}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors">
                {consolLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Consolidando…</>
                  : <><Layers className="w-4 h-4" /> Confirmar consolidación</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {rechazarModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" /> Rechazar solicitud
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Regresa a A01-SIAF. Debes indicar el motivo del rechazo.
                </p>
              </div>
              <button onClick={() => setRechazarModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="label">
                  Motivo del rechazo <span className="text-red-500 font-semibold">*</span>
                </label>
                <textarea
                  className="input min-h-[90px] resize-none text-sm"
                  placeholder="Explica por qué se rechaza esta solicitud…"
                  value={rechazarMotivo}
                  onChange={e => setRechazarMotivo(e.target.value)}
                  autoFocus
                />
              </div>
              {rechazarError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {rechazarError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setRechazarModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={confirmRechazar} disabled={rechazarLoading || !rechazarMotivo.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                {rechazarLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Rechazando…</>
                  : <><XCircle className="w-4 h-4" /> Confirmar rechazo</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
