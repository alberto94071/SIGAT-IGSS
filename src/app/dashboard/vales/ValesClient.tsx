"use client";
import { useState } from "react";
import Link from "next/link";
import { Receipt, CheckCircle2, XCircle, Printer, Loader2, AlertTriangle, X } from "lucide-react";
import { autorizarVale, rechazarVale, asignarChequeVale } from "@/lib/vale-actions";

type Vale = {
  id: number; numero: number; tipo: string; fecha: string; monto: number; monto_autorizado: number | null;
  motivo: string; estado: string; numero_cheque: string | null; destinatario_cheque: string | null;
  solicitante_nombre: string; solicitante_numero_empleado: string; solicitante_nit: string;
  jefe_nombre: string; jefe_numero_empleado: string; jefe_nit: string;
};
type Saldo = { monto_fondo_rotativo: number; saldo_disponible: number };

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const TIPO_LABEL: Record<string, string> = { pasajes: "Pago de Pasajes", gastos_varios: "Gastos Varios" };

export default function ValesClient({
  pendientes: init, autorizados: initA, activos: initAc, saldo, canEdit,
}: { pendientes: Vale[]; autorizados: Vale[]; activos: Vale[]; saldo: Saldo; canEdit: boolean }) {
  const [pendientes, setPendientes] = useState(init);
  const [autorizados, setAutorizados] = useState(initA);
  const [activos, setActivos] = useState(initAc);
  const [saldoActual, setSaldoActual] = useState(saldo.saldo_disponible);
  const [autorizando, setAutorizando] = useState<Vale | null>(null);
  const [rechazando, setRechazando] = useState<Vale | null>(null);
  const [asignando, setAsignando] = useState<Vale | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Receipt className="w-5 h-5" /> Fondo Rotativo — Vales
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Autoriza o rechaza los vales solicitados desde Caja Chica y asigna el cheque.</p>
      </div>

      <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 flex items-center justify-between flex-wrap gap-2">
        <span>Fondo Rotativo total: <strong>{Q(saldo.monto_fondo_rotativo)}</strong></span>
        <span>Saldo disponible: <strong>{Q(saldoActual)}</strong></span>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Pendientes de autorización</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left whitespace-nowrap">No. Vale</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Tipo</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                  <th className="px-4 py-3 text-left">Solicitante</th>
                  <th className="px-4 py-3 text-left">Justificación</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Monto</th>
                  {canEdit && <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendientes.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{String(v.numero).padStart(7, "0")}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{TIPO_LABEL[v.tipo] ?? v.tipo}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{v.fecha}</td>
                    <td className="px-4 py-3 text-gray-700">{v.solicitante_nombre}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate" title={v.motivo}>{v.motivo}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">{Q(v.monto)}</td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => setRechazando(v)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
                            <XCircle className="w-3 h-3" /> Rechazar
                          </button>
                          <button onClick={() => setAutorizando(v)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                            <CheckCircle2 className="w-3 h-3" /> Autorizar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {pendientes.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">No hay vales pendientes de autorización.</div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Autorizados — pendientes de asignar cheque</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left whitespace-nowrap">No. Vale</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Tipo</th>
                  <th className="px-4 py-3 text-left">Solicitante</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Monto autorizado</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {autorizados.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{String(v.numero).padStart(7, "0")}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{TIPO_LABEL[v.tipo] ?? v.tipo}</td>
                    <td className="px-4 py-3 text-gray-700">{v.solicitante_nombre}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">{Q(v.monto_autorizado ?? v.monto)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1.5">
                        <Link href={`/caja-chica/vale/${v.id}/imprimir`}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                          <Printer className="w-3 h-3" /> Imprimir
                        </Link>
                        {canEdit && (
                          <button onClick={() => setAsignando(v)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                            Asignar cheque
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {autorizados.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">No hay vales autorizados esperando cheque.</div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Vales activos</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left whitespace-nowrap">No. Vale</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Tipo</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Cheque No.</th>
                  <th className="px-4 py-3 text-left">A nombre de</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Monto</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activos.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{String(v.numero).padStart(7, "0")}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{TIPO_LABEL[v.tipo] ?? v.tipo}</td>
                    <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{v.numero_cheque}</td>
                    <td className="px-4 py-3 text-gray-700">{v.destinatario_cheque}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">{Q(v.monto_autorizado ?? v.monto)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1.5">
                        <Link href={`/caja-chica/vale/${v.id}/imprimir`}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                          <Printer className="w-3 h-3" /> Vale
                        </Link>
                        <Link href={`/dashboard/voucher/${v.id}/imprimir`}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                          <Printer className="w-3 h-3" /> Voucher
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activos.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">No hay vales activos.</div>
            )}
          </div>
        </div>
      </div>

      {autorizando && (
        <AutorizarModal
          vale={autorizando} saldoDisponible={saldoActual}
          onClose={() => setAutorizando(null)}
          onAutorizado={(montoAutorizado) => {
            setPendientes(prev => prev.filter(v => v.id !== autorizando.id));
            setAutorizados(prev => [{ ...autorizando, estado: "Autorizado", monto_autorizado: montoAutorizado }, ...prev]);
            setAutorizando(null);
          }}
        />
      )}
      {rechazando && (
        <RechazarModal
          vale={rechazando}
          onClose={() => setRechazando(null)}
          onRechazado={() => { setPendientes(prev => prev.filter(v => v.id !== rechazando.id)); setRechazando(null); }}
        />
      )}
      {asignando && (
        <AsignarChequeModal
          vale={asignando}
          onClose={() => setAsignando(null)}
          onAsignado={(numeroCheque, destinatario) => {
            setAutorizados(prev => prev.filter(v => v.id !== asignando.id));
            setActivos(prev => [{ ...asignando, estado: "Activo", numero_cheque: numeroCheque, destinatario_cheque: destinatario }, ...prev]);
            setSaldoActual(prev => prev - (asignando.monto_autorizado ?? asignando.monto));
            setAsignando(null);
          }}
        />
      )}
    </div>
  );
}

function AutorizarModal({ vale, saldoDisponible, onClose, onAutorizado }: { vale: Vale; saldoDisponible: number; onClose: () => void; onAutorizado: (monto: number) => void }) {
  const [monto, setMonto] = useState(String(vale.monto));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAutorizar() {
    const montoNum = parseFloat(monto);
    if (!(montoNum > 0)) return setError("Ingresa un monto válido");
    setSaving(true); setError("");
    const res = await autorizarVale(vale.id, montoNum);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onAutorizado(montoNum);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Autorizar vale {String(vale.numero).padStart(7, "0")}</h2>
        <p className="text-sm text-gray-600">{vale.solicitante_nombre} — {vale.motivo}</p>
        <p className="text-xs text-gray-500">Solicitado: {Q(vale.monto)} · Saldo disponible: {Q(saldoDisponible)}</p>
        <div>
          <label className="label">Monto a autorizar</label>
          <input type="number" step="0.01" min="0.01" className="input" value={monto} onChange={e => setMonto(e.target.value)} />
        </div>
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleAutorizar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Autorizar
          </button>
        </div>
      </div>
    </div>
  );
}

function RechazarModal({ vale, onClose, onRechazado }: { vale: Vale; onClose: () => void; onRechazado: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleRechazar() {
    if (!motivo.trim()) return setError("El motivo del rechazo es obligatorio");
    setSaving(true); setError("");
    const res = await rechazarVale(vale.id, motivo);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onRechazado();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Rechazar vale {String(vale.numero).padStart(7, "0")}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="label">Motivo del rechazo</label>
          <textarea className="input" rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} />
        </div>
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleRechazar} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}

function AsignarChequeModal({ vale, onClose, onAsignado }: { vale: Vale; onClose: () => void; onAsignado: (numeroCheque: string, destinatario: string) => void }) {
  const [numeroCheque, setNumeroCheque] = useState("");
  const [destinatario, setDestinatario] = useState(vale.solicitante_nombre);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAsignar() {
    if (!numeroCheque.trim()) return setError("El número de cheque es obligatorio");
    if (!destinatario.trim()) return setError("El nombre del destinatario es obligatorio");
    setSaving(true); setError("");
    const res = await asignarChequeVale(vale.id, { numero_cheque: numeroCheque, destinatario_cheque: destinatario });
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onAsignado(numeroCheque.trim(), destinatario.trim());
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Asignar cheque — Vale {String(vale.numero).padStart(7, "0")}</h2>
        <div>
          <label className="label">Cheque No.</label>
          <input className="input font-mono" value={numeroCheque} onChange={e => setNumeroCheque(e.target.value)} />
        </div>
        <div>
          <label className="label">A nombre de quién sale el cheque</label>
          <input className="input" value={destinatario} onChange={e => setDestinatario(e.target.value)} />
        </div>
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleAsignar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Asignar y generar Voucher
          </button>
        </div>
      </div>
    </div>
  );
}
