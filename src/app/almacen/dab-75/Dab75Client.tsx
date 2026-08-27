"use client";
import { fechaGuatemala } from "@/lib/date-utils";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive, X, Loader2, AlertTriangle, Printer, Search,
  ClipboardCheck, Check, Ban,
} from "lucide-react";
import { aprobarSolicitud, rechazarSolicitud, type DatosAprobacion } from "./actions";

type Item = { id: number; codigo: string; nombre: string; cantidad_solicitada: number };
type Solicitud = {
  id: number;
  no_pedido: string | null; fecha_emision: string | null; clave_administrativa: string | null;
  sala_servicio: string | null; bodega: string | null; fecha_despacho: string | null;
  solicita_nombre: string | null; solicita_no_empleado: string | null; solicita_cargo: string | null;
  estado: string; motivo_rechazo: string | null;
  items: Item[];
};

const ESTADO_STYLE: Record<string, string> = {
  "Pendiente": "bg-blue-100 text-blue-700",
  "Aprobado":  "bg-green-100 text-green-700",
  "Rechazado": "bg-red-100 text-red-700",
};

type Tab = "pendiente" | "aprobado" | "rechazado";
const TABS: { id: Tab; label: string; estado: string }[] = [
  { id: "pendiente", label: "Pendientes", estado: "Pendiente" },
  { id: "aprobado",  label: "Aprobadas",  estado: "Aprobado" },
  { id: "rechazado", label: "Rechazadas", estado: "Rechazado" },
];

export default function Dab75Client({ solicitudes: init, canEdit }: { solicitudes: Solicitud[]; canEdit: boolean }) {
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState(init);
  const [tab, setTab] = useState<Tab>("pendiente");
  const [query, setQuery] = useState("");
  const [revisando, setRevisando] = useState<Solicitud | null>(null);
  const [rechazando, setRechazando] = useState<Solicitud | null>(null);

  const conteos = useMemo(() => ({
    pendiente: solicitudes.filter(s => s.estado === "Pendiente").length,
    aprobado:  solicitudes.filter(s => s.estado === "Aprobado").length,
    rechazado: solicitudes.filter(s => s.estado === "Rechazado").length,
  }), [solicitudes]);

  const q = query.toLowerCase().trim();
  const filtradas = useMemo(() => {
    const estadoTab = TABS.find(t => t.id === tab)!.estado;
    return solicitudes.filter(s => s.estado === estadoTab).filter(s => !q ||
      (s.no_pedido ?? "").toLowerCase().includes(q) ||
      (s.sala_servicio ?? "").toLowerCase().includes(q) ||
      (s.solicita_nombre ?? "").toLowerCase().includes(q) ||
      s.items.some(i => i.nombre.toLowerCase().includes(q) || i.codigo.toLowerCase().includes(q))
    );
  }, [solicitudes, tab, q]);

  function onAprobada(id: number) {
    setSolicitudes(prev => prev.map(s => s.id === id ? { ...s, estado: "Aprobado" } : s));
    setRevisando(null);
    router.refresh();
  }
  function onRechazada(id: number) {
    setSolicitudes(prev => prev.map(s => s.id === id ? { ...s, estado: "Rechazado" } : s));
    setRechazando(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Archive className="w-5 h-5" /> DAB-75 — Requisición a Bodega Local
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Solicitudes de insumos hechas por colaboradores — revisá, ajustá cantidades y aprobá o rechazá.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t.label} {conteos[t.id] > 0 && <span className="text-xs text-gray-400">({conteos[t.id]})</span>}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por pedido, sala, solicitante o insumo…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Pedido</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha Emisión</th>
                <th className="px-4 py-3 text-left">Sala o Servicio</th>
                <th className="px-4 py-3 text-left">Solicita</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Insumos</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtradas.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{s.no_pedido ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.fecha_emision ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{s.sala_servicio ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{s.solicita_nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {s.items.slice(0, 2).map(i => i.nombre).join(", ")}
                    {s.items.length > 2 ? ` +${s.items.length - 2} más` : ""}
                    {s.estado === "Rechazado" && s.motivo_rechazo && (
                      <p className="text-red-500 mt-1">Motivo: {s.motivo_rechazo}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {s.estado === "Pendiente" && canEdit ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setRechazando(s)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                          <Ban className="w-3 h-3" /> Rechazar
                        </button>
                        <button onClick={() => setRevisando(s)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                          <ClipboardCheck className="w-3.5 h-3.5" /> Revisar
                        </button>
                      </div>
                    ) : s.estado === "Aprobado" ? (
                      <Link href={`/almacen/dab-75/${s.id}/imprimir`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                        <Printer className="w-3 h-3" /> Imprimir
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtradas.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{q ? "Sin resultados para esa búsqueda." : "Nada por acá todavía."}</p>
            </div>
          )}
        </div>
      </div>

      {revisando && (
        <RevisarModal solicitud={revisando} onClose={() => setRevisando(null)} onAprobada={onAprobada} />
      )}
      {rechazando && (
        <RechazarModal solicitud={rechazando} onClose={() => setRechazando(null)} onRechazada={onRechazada} />
      )}
    </div>
  );
}

function RevisarModal({ solicitud: s, onClose, onAprobada }: {
  solicitud: Solicitud; onClose: () => void; onAprobada: (id: number) => void;
}) {
  const hoy = fechaGuatemala();
  const [noPedido, setNoPedido] = useState("");
  const [claveAdmin, setClaveAdmin] = useState("");
  const [bodega, setBodega] = useState<"I" | "II">("I");
  const [fechaDespacho, setFechaDespacho] = useState(hoy);
  const [cantidades, setCantidades] = useState<Record<number, number>>(
    Object.fromEntries(s.items.map(i => [i.id, i.cantidad_solicitada]))
  );

  const [entNombre, setEntNombre] = useState(""); const [entEmpleado, setEntEmpleado] = useState(""); const [entCargo, setEntCargo] = useState("");
  const [recNombre, setRecNombre] = useState(""); const [recEmpleado, setRecEmpleado] = useState(""); const [recCargo, setRecCargo] = useState("");
  const [directorNombre, setDirectorNombre] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAprobar() {
    if (!noPedido.trim()) return setError("El No. de Pedido es obligatorio");
    if (!claveAdmin.trim()) return setError("La Clave Administrativa es obligatoria");
    for (const it of s.items) {
      if (!(cantidades[it.id] > 0)) return setError(`La cantidad de "${it.nombre}" debe ser mayor a cero`);
    }

    setSaving(true); setError("");
    const datos: DatosAprobacion = {
      no_pedido: noPedido, clave_administrativa: claveAdmin, bodega, fecha_despacho: fechaDespacho,
      entrega_nombre: entNombre, entrega_no_empleado: entEmpleado, entrega_cargo: entCargo,
      recibe_nombre: recNombre, recibe_no_empleado: recEmpleado, recibe_cargo: recCargo,
      director_nombre: directorNombre,
      items: s.items.map(it => ({ id: it.id, cantidad_solicitada: cantidades[it.id] })),
    };
    const res = await aprobarSolicitud(s.id, datos);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onAprobada(s.id);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Revisar y Aprobar — Solicitud de {s.solicita_nombre ?? "colaborador"}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="text-gray-500">Sala o Servicio: <span className="text-gray-900 font-medium">{s.sala_servicio}</span></p>
            <p className="text-gray-500">Solicita: <span className="text-gray-900 font-medium">{s.solicita_nombre}</span> · No. Empleado (IBM): {s.solicita_no_empleado} · {s.solicita_cargo}</p>
          </div>

          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Insumos solicitados — podés ajustar la cantidad</p>
          <div className="space-y-1.5">
            {s.items.map(it => (
              <div key={it.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-gray-900">{it.nombre}</span>
                <input type="number" min={0} step="0.01" className="input w-28 text-sm"
                  value={cantidades[it.id]}
                  onChange={e => setCantidades(prev => ({ ...prev, [it.id]: parseFloat(e.target.value) || 0 }))} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="label">No. de Pedido</label>
              <input className="input font-mono" value={noPedido} onChange={e => setNoPedido(e.target.value)} />
            </div>
            <div>
              <label className="label">Clave Administrativa</label>
              <input className="input" value={claveAdmin} onChange={e => setClaveAdmin(e.target.value)} />
            </div>
            <div>
              <label className="label">Fecha de Despacho</label>
              <input type="date" className="input" value={fechaDespacho} onChange={e => setFechaDespacho(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="radio" checked={bodega === "I"} onChange={() => setBodega("I")} className="accent-brand-600" /> Bodega I
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="radio" checked={bodega === "II"} onChange={() => setBodega("II")} className="accent-brand-600" /> Bodega II
            </label>
          </div>

          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider pt-1">Entrega (opcional — puede llenarse al despachar)</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="label">Nombre</label>
              <input className="input" value={entNombre} onChange={e => setEntNombre(e.target.value)} />
            </div>
            <div><label className="label">No. Empleado</label><input className="input font-mono" value={entEmpleado} onChange={e => setEntEmpleado(e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Cargo</label><input className="input" value={entCargo} onChange={e => setEntCargo(e.target.value)} /></div>
          </div>

          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider pt-1">Recibe (opcional — puede llenarse al despachar)</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="label">Nombre</label>
              <input className="input" value={recNombre} onChange={e => setRecNombre(e.target.value)} />
            </div>
            <div><label className="label">No. Empleado</label><input className="input font-mono" value={recEmpleado} onChange={e => setRecEmpleado(e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Cargo</label><input className="input" value={recCargo} onChange={e => setRecCargo(e.target.value)} /></div>
          </div>

          <div>
            <label className="label">Vo.Bo. Director — Nombre (opcional)</label>
            <input className="input" value={directorNombre} onChange={e => setDirectorNombre(e.target.value)} />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleAprobar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aprobar
          </button>
        </div>
      </div>
    </div>
  );
}

function RechazarModal({ solicitud: s, onClose, onRechazada }: {
  solicitud: Solicitud; onClose: () => void; onRechazada: (id: number) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleRechazar() {
    if (!motivo.trim()) return setError("Indicá el motivo del rechazo");
    setSaving(true); setError("");
    const res = await rechazarSolicitud(s.id, motivo);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onRechazada(s.id);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Rechazar solicitud</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-500">
          Solicitud de <span className="font-medium text-gray-900">{s.solicita_nombre}</span> — {s.items.length} insumo(s).
        </p>
        <div>
          <label className="label">Motivo del rechazo</label>
          <textarea className="input" rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} />
        </div>
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleRechazar} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}
