"use client";
import { useState } from "react";
import { FileCheck, Loader2, X, Send, CheckCircle, XCircle, Undo2 } from "lucide-react";
import { registrarDevengado, aprobarDevengado, rechazarDevengado, actualizarEstadoDevengado, type EstadoDevengado } from "@/lib/adjudicacion/devengado-actions";
import { regresarACompromiso, regresarADab60 } from "@/lib/adjudicacion/compromiso-actions";
import { fechaGuatemala } from "@/lib/date-utils";
import RenglonBadges from "@/components/RenglonBadges";

type Orden = {
  id: number; numero: number; anio: number; tipo_compra: string;
  proveedor_nit: string | null; proveedor_nombre: string | null;
  total: number | null; codigo_ppr: string | null; no_compromiso: string | null;
  no_devengado?: string | null; fecha_envio_daf?: string | null;
  estado_devengado?: string | null; fecha_pago?: string | null;
  dab60_generado_en?: string | null;
  renglones: { renglon: number | null; subproducto: string; nombre: string; cantidad: number }[];
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DevengadoClient({ ordenes: init, solicitadas: initSolicitadas, enviadas: initEnviadas }: { ordenes: Orden[]; solicitadas: Orden[]; enviadas: Orden[] }) {
  const [ordenes, setOrdenes] = useState(init);
  const [solicitadas, setSolicitadas] = useState(initSolicitadas);
  const [enviadas, setEnviadas] = useState(initEnviadas);
  const [devengarFor, setDevengarFor] = useState<Orden | null>(null);
  const [acciones, setAcciones] = useState<Record<number, { cargando: boolean; error: string | null }>>({});
  const [accionesRegresar, setAccionesRegresar] = useState<Record<number, { cargando: boolean; error: string | null }>>({});

  function onRegistrado(orden: Orden) {
    setOrdenes(p => p.filter(x => x.id !== orden.id));
    setSolicitadas(p => [...p, orden]);
  }

  const handleRegresar = async (id: number, origen: "ordenes" | "enviadas") => {
    if (!confirm("¿Devolver esta orden a Compromiso? Se deshacen los movimientos de presupuesto que ya se habían hecho (Devengado y/o Compromiso) y tendrá que registrarse un nuevo No. de Compromiso.")) return;
    setAccionesRegresar(prev => ({ ...prev, [id]: { cargando: true, error: null } }));
    const res = await regresarACompromiso(id);
    if ("error" in res) {
      setAccionesRegresar(prev => ({ ...prev, [id]: { cargando: false, error: res.error } }));
    } else {
      setAccionesRegresar(prev => ({ ...prev, [id]: { cargando: false, error: null } }));
      if (origen === "ordenes") setOrdenes(p => p.filter(o => o.id !== id));
      else setEnviadas(p => p.filter(o => o.id !== id));
    }
  };

  // Rechazada por la DAF: si la orden pasó por Almacén/DAB-60, el error
  // más probable está en los datos que capturó Almacén (no en el
  // Compromiso, que sigue siendo válido) — se devuelve solo hasta la
  // bandeja de aprobación de DAB-60, no hasta Compromiso.
  const handleRegresarDab60 = async (o: Orden) => {
    if (!confirm("¿Devolver esta orden a la bandeja de aprobación de Almacén/DAB-60 para corregir sus datos? El Compromiso no se toca, solo se deshace el Devengado.")) return;
    setAccionesRegresar(prev => ({ ...prev, [o.id]: { cargando: true, error: null } }));
    const res = await regresarADab60(o.id);
    if ("error" in res) {
      setAccionesRegresar(prev => ({ ...prev, [o.id]: { cargando: false, error: res.error } }));
    } else {
      setAccionesRegresar(prev => ({ ...prev, [o.id]: { cargando: false, error: null } }));
      setEnviadas(p => p.filter(x => x.id !== o.id));
    }
  };

  const ejecutarAccion = async (id: number, accion: (id: number) => Promise<{ ok: true } | { error: string }>, alAprobar?: (o: Orden) => void) => {
    setAcciones(prev => ({ ...prev, [id]: { cargando: true, error: null } }));
    const res = await accion(id);
    if ("error" in res) {
      setAcciones(prev => ({ ...prev, [id]: { cargando: false, error: res.error } }));
    } else {
      setAcciones(prev => ({ ...prev, [id]: { cargando: false, error: null } }));
      const orden = solicitadas.find(o => o.id === id);
      setSolicitadas(prev => prev.filter(o => o.id !== id));
      if (orden && alAprobar) alAprobar(orden);
    }
  };

  function onEstadoActualizado(id: number, estado: EstadoDevengado, fechaPago: string | null) {
    setEnviadas(p => p.map(x => x.id === id ? { ...x, estado_devengado: estado, fecha_pago: fechaPago } : x));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileCheck className="w-5 h-5" /> Presupuesto — Devengado
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{ordenes.length} orden(es) pendiente(s) de devengar</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Orden</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Compromiso</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ordenes.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                    OC-{String(o.numero).padStart(3, "0")}/{o.anio}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{o.no_compromiso ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{o.proveedor_nombre ?? "—"}</p>
                    {o.proveedor_nit && <p className="text-xs text-gray-400">NIT: {o.proveedor_nit}</p>}
                    <RenglonBadges renglones={o.renglones} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                    {o.total != null ? Q(o.total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => handleRegresar(o.id, "ordenes")}
                        disabled={accionesRegresar[o.id]?.cargando}
                        title="Devolver a Compromiso"
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50">
                        {accionesRegresar[o.id]?.cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setDevengarFor(o)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                        <FileCheck className="w-3 h-3" /> Devengar
                      </button>
                    </div>
                    {accionesRegresar[o.id]?.error && <p className="text-red-600 text-xs mt-1 max-w-[180px]">{accionesRegresar[o.id]!.error}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ordenes.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay órdenes pendientes de devengar.</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900">Pendientes de aprobación de Devengado</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {solicitadas.length} orden(es) con No. de Devengado registrado, esperando aprobación de Presupuesto. Mientras no se apruebe, no se refleja en Ejecución ni se envía a la DAF.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Orden</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Devengado</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {solicitadas.map(o => {
                const a = acciones[o.id];
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                      OC-{String(o.numero).padStart(3, "0")}/{o.anio}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{o.no_devengado ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{o.proveedor_nombre ?? "—"}</p>
                      {o.proveedor_nit && <p className="text-xs text-gray-400">NIT: {o.proveedor_nit}</p>}
                      <RenglonBadges renglones={o.renglones} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                      {o.total != null ? Q(o.total) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => ejecutarAccion(o.id, aprobarDevengado, (ord) => setEnviadas(p => [{ ...ord, estado_devengado: "Enviado" }, ...p]))}
                          disabled={a?.cargando}
                          title="Aprobar"
                          className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => ejecutarAccion(o.id, rechazarDevengado)}
                          disabled={a?.cargando}
                          title="Rechazar"
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                      {a?.error && <p className="text-red-600 text-xs mt-1 max-w-[180px]">{a.error}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {solicitadas.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay devengados pendientes de aprobación.</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900">Seguimiento de pago (DAF)</h2>
        <p className="text-sm text-gray-500 mt-0.5">Expedientes ya devengados y remitidos a la División de Administración Financiera</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Orden</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Devengado</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Envío a DAF</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enviadas.map(o => (
                <FilaSeguimiento
                  key={o.id} orden={o} onActualizado={onEstadoActualizado}
                  onRegresar={() => o.dab60_generado_en ? handleRegresarDab60(o) : handleRegresar(o.id, "enviadas")}
                  etiquetaRegresar={o.dab60_generado_en ? "Devolver a Almacén/DAB-60" : "Devolver a Compromiso"}
                  regresando={accionesRegresar[o.id]?.cargando ?? false}
                  errorRegresar={accionesRegresar[o.id]?.error ?? null}
                />
              ))}
            </tbody>
          </table>
          {enviadas.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Send className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Todavía no hay expedientes enviados a la DAF.</p>
            </div>
          )}
        </div>
      </div>

      {devengarFor && (
        <DevengarModal orden={devengarFor} onClose={() => setDevengarFor(null)} onDone={onRegistrado} />
      )}
    </div>
  );
}

function DevengarModal({ orden: o, onClose, onDone }: { orden: Orden; onClose: () => void; onDone: (orden: Orden) => void }) {
  const [noDevengado, setNoDevengado] = useState("");
  const [fechaEnvioDaf, setFechaEnvioDaf] = useState(fechaGuatemala());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function guardar() {
    setSaving(true); setError("");
    const res = await registrarDevengado(o.id, { no_devengado: noDevengado, fecha_envio_daf: fechaEnvioDaf });
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    onDone({ ...o, no_devengado: noDevengado, fecha_envio_daf: fechaEnvioDaf });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">
            Devengar OC-{String(o.numero).padStart(3, "0")}/{o.anio}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div>
          <label className="text-sm text-gray-600 font-medium block mb-1">No. de Devengado</label>
          <input type="text" value={noDevengado} onChange={e => setNoDevengado(e.target.value)}
            className="input w-full rounded-lg" placeholder="Ej. 1234" />
        </div>
        <div>
          <label className="text-sm text-gray-600 font-medium block mb-1">Fecha de envío a la DAF</label>
          <input type="date" value={fechaEnvioDaf} onChange={e => setFechaEnvioDaf(e.target.value)}
            className="input w-full rounded-lg" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
          <button onClick={guardar} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />} Registrar Devengado
          </button>
        </div>
      </div>
    </div>
  );
}

const BADGE: Record<string, string> = {
  Enviado: "bg-blue-100 text-blue-700",
  Rechazado: "bg-red-100 text-red-700",
  Pagado: "bg-green-100 text-green-700",
};

function FilaSeguimiento({ orden: o, onActualizado, onRegresar, etiquetaRegresar, regresando, errorRegresar }: {
  orden: Orden;
  onActualizado: (id: number, estado: EstadoDevengado, fechaPago: string | null) => void;
  onRegresar: () => void;
  etiquetaRegresar: string;
  regresando: boolean;
  errorRegresar: string | null;
}) {
  const [fechaPago, setFechaPago] = useState(fechaGuatemala());
  const [pidiendoFechaPago, setPidiendoFechaPago] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function marcar(estado: EstadoDevengado, fecha?: string) {
    setGuardando(true); setError("");
    const res = await actualizarEstadoDevengado(o.id, estado, fecha);
    setGuardando(false);
    if ("error" in res) { setError(res.error); return; }
    onActualizado(o.id, estado, estado === "Pagado" ? fecha ?? null : null);
    setPidiendoFechaPago(false);
  }

  return (
    <tr className="hover:bg-gray-50 align-top">
      <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
        OC-{String(o.numero).padStart(3, "0")}/{o.anio}
      </td>
      <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{o.no_devengado ?? "—"}</td>
      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{o.fecha_envio_daf ?? "—"}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${BADGE[o.estado_devengado ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
          {o.estado_devengado ?? "—"}
        </span>
        {o.estado_devengado === "Pagado" && o.fecha_pago && (
          <p className="text-xs text-gray-400 mt-0.5">Pagado el {o.fecha_pago}</p>
        )}
        {error && <p className="text-xs text-red-600 mt-1 max-w-[180px]">{error}</p>}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {o.estado_devengado === "Enviado" && !pidiendoFechaPago && (
          <div className="flex items-center gap-1.5 justify-end">
            <button onClick={() => marcar("Rechazado")} disabled={guardando}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50">
              Rechazar
            </button>
            <button onClick={() => setPidiendoFechaPago(true)} disabled={guardando}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50">
              Pagado
            </button>
          </div>
        )}
        {pidiendoFechaPago && (
          <div className="flex items-center gap-1.5 justify-end">
            <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}
              className="input py-1 text-xs rounded-lg" />
            <button onClick={() => marcar("Pagado", fechaPago)} disabled={guardando}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
              {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirmar"}
            </button>
          </div>
        )}
        {o.estado_devengado !== "Pagado" && !pidiendoFechaPago && (
          <button onClick={onRegresar} disabled={regresando} title={etiquetaRegresar}
            className="mt-1.5 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50 ml-auto">
            {regresando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />} {etiquetaRegresar}
          </button>
        )}
        {errorRegresar && <p className="text-xs text-red-600 mt-1 max-w-[180px] text-right">{errorRegresar}</p>}
      </td>
    </tr>
  );
}
