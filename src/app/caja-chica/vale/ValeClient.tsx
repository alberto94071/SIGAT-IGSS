"use client";
import { useState } from "react";
import Link from "next/link";
import { Receipt, Plus, X, Loader2, AlertTriangle } from "lucide-react";
import { crearVale, type NuevoValeData, type TipoVale } from "@/lib/vale-actions";

type Vale = {
  id: number; numero: number; tipo: string; fecha: string; monto: number; monto_autorizado: number | null;
  motivo: string; estado: string; motivo_rechazo: string | null; numero_cheque: string | null;
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const TIPO_LABEL: Record<string, string> = { pasajes: "Pago de Pasajes", gastos_varios: "Gastos Varios" };
const ESTADO_COLOR: Record<string, string> = {
  "Pendiente autorización": "bg-amber-100 text-amber-700",
  "Autorizado": "bg-blue-100 text-blue-700",
  "Activo": "bg-green-100 text-green-700",
  "Liquidado": "bg-gray-100 text-gray-600",
  "Rechazado": "bg-red-100 text-red-700",
};

export default function ValeClient({ vales: init, canEdit }: { vales: Vale[]; canEdit: boolean }) {
  const [vales, setVales] = useState(init);
  const [modal, setModal] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-5 h-5" /> Vale de Caja Chica
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{vales.length} vale(s) registrado(s)</p>
        </div>
        {canEdit && (
          <button onClick={() => setModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo Vale
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Vale</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Tipo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left">Motivo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Monto</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vales.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                    {String(v.numero).padStart(7, "0")}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{TIPO_LABEL[v.tipo] ?? v.tipo}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{v.fecha}</td>
                  <td className="px-4 py-3 text-xs text-gray-700 max-w-xs truncate" title={v.motivo}>{v.motivo}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[v.estado] ?? "bg-gray-100 text-gray-600"}`}>
                      {v.estado}
                    </span>
                    {v.estado === "Rechazado" && v.motivo_rechazo && (
                      <p className="text-[10px] text-red-600 mt-0.5 max-w-[180px]" title={v.motivo_rechazo}>{v.motivo_rechazo}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                    {Q(v.monto_autorizado ?? v.monto)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {v.numero_cheque && (
                      <Link href={`/caja-chica/vale/${v.id}/imprimir`}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors ml-auto w-fit">
                        Imprimir
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vales.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aún no se ha registrado ningún vale.</p>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <NuevoValeModal
          onClose={() => setModal(false)}
          onCreado={vale => { setVales(p => [vale as unknown as Vale, ...p]); setModal(false); }}
        />
      )}
    </div>
  );
}

function NuevoValeModal({ onClose, onCreado }: { onClose: () => void; onCreado: (v: unknown) => void }) {
  const [tipo, setTipo] = useState<TipoVale>("pasajes");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleGuardar() {
    const montoNum = parseFloat(monto);
    if (!(montoNum > 0)) return setError("Ingresa un monto válido");
    if (!motivo.trim()) return setError("La justificación es obligatoria");

    const data: NuevoValeData = { tipo, monto: montoNum, motivo: motivo.trim() };
    setSaving(true); setError("");
    const res = await crearVale(data);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onCreado(res.vale);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Nuevo Vale de Caja Chica</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="label">Tipo de vale</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                <input type="radio" name="tipo" checked={tipo === "pasajes"} onChange={() => setTipo("pasajes")} className="w-4 h-4 accent-brand-600" /> Pago de Pasajes
              </label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                <input type="radio" name="tipo" checked={tipo === "gastos_varios"} onChange={() => setTipo("gastos_varios")} className="w-4 h-4 accent-brand-600" /> Gastos Varios
              </label>
            </div>
          </div>

          <div>
            <label className="label">Monto solicitado</label>
            <input type="number" step="0.01" min="0.01" className="input" value={monto} onChange={e => setMonto(e.target.value)} />
          </div>

          <div>
            <label className="label">Justificación</label>
            <textarea className="input" rows={2} value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Motivo por el que se solicita el vale" />
          </div>

          <p className="text-xs text-gray-400">
            Se enviará a Fondo Rotativo/Vales para su autorización. No puedes tener dos vales activos del mismo tipo a la vez.
          </p>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Enviar Solicitud
          </button>
        </div>
      </div>
    </div>
  );
}
