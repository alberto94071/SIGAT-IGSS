"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapPin, X, Loader2, AlertTriangle, ClipboardCheck, Check, Ban } from "lucide-react";
import { fechaGuatemala } from "@/lib/date-utils";
import {
  habilitarSolicitud, type DatosHabilitar,
  getSolicitudCompleta, aprobarSolicitud, rechazarSolicitud, type DatosAprobar,
} from "./actions";

type Pendiente = {
  id: number; created_at: string | null;
  colaborador_nombre: string; colaborador_ibm: string | null; colaborador_puesto: string | null;
  colaborador_nit: string | null; colaborador_salario: number | null;
  colaborador_grupo: string | null; colaborador_categoria_puesto: string | null;
};
type Enviada = { id: number; numero_formulario: string | null; persona_nombre: string | null };
type Comision = {
  id: number; orden: number; lugar: string | null; departamento: string | null;
  descripcion_comision: string | null; dias_calculados: number | null;
  nombramiento_numero: string | null; fecha_nombramiento: string | null;
  cantidad_desayuno: number; cantidad_almuerzo: number; cantidad_cena: number; cantidad_hospedaje: number;
};
type SolicitudCompleta = { id: number; numero_formulario: string | null; persona_nombre: string | null; comisiones: Comision[] };

export default function RegistroComisionClient({ pendientes: init, enviadas, canEdit }: {
  pendientes: Pendiente[]; enviadas: Enviada[]; canEdit: boolean;
}) {
  const router = useRouter();
  const [pendientes, setPendientes] = useState(init);
  const [enviadasState, setEnviadasState] = useState(enviadas);
  const [habilitando, setHabilitando] = useState<Pendiente | null>(null);
  const [revisandoId, setRevisandoId] = useState<number | null>(null);

  function onHabilitada(id: number) {
    setPendientes(prev => prev.filter(p => p.id !== id));
    setHabilitando(null);
  }

  function onResuelta(id: number) {
    setEnviadasState(prev => prev.filter(e => e.id !== id));
    setRevisandoId(null);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin className="w-5 h-5" /> Registro de Comisión
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Solicitudes de viático que pidieron los colaboradores — habilitalas con el nombramiento inicial antes de que registren su comisión.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Pendientes de habilitar ({pendientes.length})</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Colaborador</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">IBM</th>
                  <th className="px-4 py-3 text-left">Puesto Nominal</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Pedido el</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendientes.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.colaborador_nombre}</td>
                    <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">{p.colaborador_ibm ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{p.colaborador_puesto ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.created_at ?? "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canEdit ? (
                        <button onClick={() => setHabilitando(p)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors ml-auto">
                          <ClipboardCheck className="w-3.5 h-3.5" /> Habilitar
                        </button>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pendientes.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nada por acá todavía.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Pendientes de revisión final ({enviadasState.length})</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left whitespace-nowrap">No. Formulario</th>
                  <th className="px-4 py-3 text-left">Colaborador</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enviadasState.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{e.numero_formulario ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{e.persona_nombre ?? "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canEdit ? (
                        <button onClick={() => setRevisandoId(e.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors ml-auto">
                          <ClipboardCheck className="w-3.5 h-3.5" /> Revisar
                        </button>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {enviadasState.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nada pendiente de revisión.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {habilitando && (
        <HabilitarModal solicitud={habilitando} onClose={() => setHabilitando(null)} onHabilitada={onHabilitada} />
      )}
      {revisandoId != null && (
        <RevisarModal solicitudId={revisandoId} onClose={() => setRevisandoId(null)} onResuelta={onResuelta} />
      )}
    </div>
  );
}

function HabilitarModal({ solicitud: p, onClose, onHabilitada }: {
  solicitud: Pendiente; onClose: () => void; onHabilitada: (id: number) => void;
}) {
  const [numeroFormulario, setNumeroFormulario] = useState("");
  const [nombramientoNumero, setNombramientoNumero] = useState("");
  const [fechaNombramiento, setFechaNombramiento] = useState(fechaGuatemala());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleHabilitar() {
    setSaving(true); setError("");
    const datos: DatosHabilitar = {
      numero_formulario: numeroFormulario, nombramiento_numero: nombramientoNumero, fecha_nombramiento: fechaNombramiento,
    };
    const res = await habilitarSolicitud(p.id, datos);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onHabilitada(p.id);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Habilitar viático — {p.colaborador_nombre}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-0.5">
            <p className="text-gray-500">IBM: <span className="text-gray-900 font-medium">{p.colaborador_ibm ?? "—"}</span></p>
            <p className="text-gray-500">Puesto nominal: <span className="text-gray-900 font-medium">{p.colaborador_puesto ?? "—"}</span></p>
            <p className="text-gray-500">NIT: <span className="text-gray-900 font-medium">{p.colaborador_nit ?? "—"}</span></p>
            <p className="text-gray-500">Salario: <span className="text-gray-900 font-medium">{p.colaborador_salario != null ? `Q${p.colaborador_salario.toLocaleString("es-GT", { minimumFractionDigits: 2 })}` : "—"}</span></p>
            <p className="text-gray-500">Grupo: <span className="text-gray-900 font-medium">{p.colaborador_grupo ?? "—"}</span></p>
            <p className="text-gray-500">Categoría de puesto: <span className="text-gray-900 font-medium">{p.colaborador_categoria_puesto ?? "—"}</span></p>
          </div>

          <div>
            <label className="label">No. de Formulario (talonario)</label>
            <input className="input font-mono" value={numeroFormulario} onChange={e => setNumeroFormulario(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">No. de Nombramiento</label>
              <input className="input font-mono" value={nombramientoNumero} onChange={e => setNombramientoNumero(e.target.value)} />
            </div>
            <div>
              <label className="label">Fecha de Nombramiento</label>
              <input type="date" className="input" value={fechaNombramiento} onChange={e => setFechaNombramiento(e.target.value)} />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleHabilitar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />} Habilitar
          </button>
        </div>
      </div>
    </div>
  );
}

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;

function RevisarModal({ solicitudId, onClose, onResuelta }: {
  solicitudId: number; onClose: () => void; onResuelta: (id: number) => void;
}) {
  const [sol, setSol] = useState<SolicitudCompleta | null>(null);
  const [otrosGastos, setOtrosGastos] = useState("0");
  const [motivo, setMotivo] = useState("");
  const [mostrandoRechazo, setMostrandoRechazo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSolicitudCompleta(solicitudId).then(data => setSol(data as SolicitudCompleta | null));
  }, [solicitudId]);

  async function handleAprobar() {
    setSaving(true); setError("");
    const datos: DatosAprobar = {
      otros_gastos: Number(otrosGastos) || 0,
      recibido_va_no: "", recibido_va_monto: null, reintegro: null, complemento: null,
    };
    const res = await aprobarSolicitud(solicitudId, datos);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onResuelta(solicitudId);
  }

  async function handleRechazar() {
    setSaving(true); setError("");
    const res = await rechazarSolicitud(solicitudId, motivo);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onResuelta(solicitudId);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Revisar viático{sol ? ` — ${sol.persona_nombre}` : ""}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        {!sol ? (
          <div className="px-5 py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : (
          <div className="px-5 py-5 space-y-4">
            <p className="text-sm text-gray-500">Formulario {sol.numero_formulario} — {sol.comisiones.length} comisión(es)</p>

            <div className="space-y-2">
              {sol.comisiones.map(c => {
                const costo = c.cantidad_desayuno * 45 + c.cantidad_almuerzo * 60 + c.cantidad_cena * 45 + c.cantidad_hospedaje * 150;
                return (
                  <div key={c.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                    <p className="font-medium text-gray-900">Comisión {c.orden}: {c.descripcion_comision}</p>
                    <p className="text-gray-500">{c.lugar}, {c.departamento} — {c.dias_calculados} día(s) — Nombramiento {c.nombramiento_numero} ({c.fecha_nombramiento})</p>
                    <p className="text-gray-600 text-xs mt-1">
                      {c.cantidad_desayuno > 0 && `${c.cantidad_desayuno} desayuno(s) `}
                      {c.cantidad_almuerzo > 0 && `${c.cantidad_almuerzo} almuerzo(s) `}
                      {c.cantidad_cena > 0 && `${c.cantidad_cena} cena(s) `}
                      {c.cantidad_hospedaje > 0 && `${c.cantidad_hospedaje} hospedaje(s) `}
                      — subtotal aprox. {Q(costo)}
                    </p>
                  </div>
                );
              })}
            </div>

            {!mostrandoRechazo ? (
              <div>
                <label className="label">Otros gastos derivados (comprobantes/planilla)</label>
                <input type="number" min={0} step="0.01" className="input" value={otrosGastos} onChange={e => setOtrosGastos(e.target.value)} />
              </div>
            ) : (
              <div>
                <label className="label">Motivo del rechazo</label>
                <textarea className="input" rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} />
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          {sol && !mostrandoRechazo && (
            <>
              <button onClick={() => setMostrandoRechazo(true)} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors">
                <Ban className="w-4 h-4" /> Rechazar
              </button>
              <button onClick={handleAprobar} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aprobar
              </button>
            </>
          )}
          {sol && mostrandoRechazo && (
            <button onClick={handleRechazar} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Confirmar Rechazo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
