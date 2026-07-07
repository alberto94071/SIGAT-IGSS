"use client";
import { useState } from "react";
import Link from "next/link";
import { Receipt, Plus, X, Loader2, AlertTriangle, Printer } from "lucide-react";
import { crearVale, type NuevoValeData } from "./actions";

type Vale = {
  id: number; numero: number; fecha: string; monto: number; motivo: string;
  solicitante_nombre: string; numero_cheque: string;
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left">Motivo</th>
                <th className="px-4 py-3 text-left">Solicitante</th>
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
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{v.fecha}</td>
                  <td className="px-4 py-3 text-xs text-gray-700 max-w-xs truncate" title={v.motivo}>{v.motivo}</td>
                  <td className="px-4 py-3 text-gray-700">{v.solicitante_nombre}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">{Q(v.monto)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/caja-chica/vale/${v.id}/imprimir`} target="_blank"
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors ml-auto w-fit">
                      <Printer className="w-3 h-3" /> Imprimir
                    </Link>
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
          onCreado={vale => { setVales(p => [vale, ...p]); setModal(false); }}
        />
      )}
    </div>
  );
}

function NuevoValeModal({ onClose, onCreado }: { onClose: () => void; onCreado: (v: Vale) => void }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(hoy);
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [solNombre, setSolNombre] = useState(""); const [solEmpleado, setSolEmpleado] = useState(""); const [solNit, setSolNit] = useState("");
  const [mismoJefe, setMismoJefe] = useState(true);
  const [jefeNombre, setJefeNombre] = useState(""); const [jefeEmpleado, setJefeEmpleado] = useState(""); const [jefeNit, setJefeNit] = useState("");
  const [cheque, setCheque] = useState("");
  const [fechaEmision, setFechaEmision] = useState(hoy);
  const [fechaEntregado, setFechaEntregado] = useState(hoy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleGuardar() {
    const montoNum = parseFloat(monto);
    if (!(montoNum > 0)) return setError("Ingresa un monto válido");
    if (!motivo.trim()) return setError("El motivo es obligatorio");
    if (!solNombre.trim() || !solEmpleado.trim() || !solNit.trim()) return setError("Los datos del solicitante son obligatorios");
    const jNombre = mismoJefe ? solNombre : jefeNombre;
    const jEmpleado = mismoJefe ? solEmpleado : jefeEmpleado;
    const jNit = mismoJefe ? solNit : jefeNit;
    if (!jNombre.trim() || !jEmpleado.trim() || !jNit.trim()) return setError("Los datos del Jefe de la Dependencia son obligatorios");
    if (!cheque.trim()) return setError("El número de cheque es obligatorio");

    const data: NuevoValeData = {
      fecha, monto: montoNum, motivo: motivo.trim(),
      solicitante_nombre: solNombre.trim(), solicitante_numero_empleado: solEmpleado.trim(), solicitante_nit: solNit.trim(),
      jefe_nombre: jNombre.trim(), jefe_numero_empleado: jEmpleado.trim(), jefe_nit: jNit.trim(),
      numero_cheque: cheque.trim(), fecha_emision: fechaEmision, fecha_entregado: fechaEntregado,
    };
    setSaving(true); setError("");
    const res = await crearVale(data);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onCreado(res.vale as unknown as Vale);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Nuevo Vale de Caja Chica</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <label className="label">Monto</label>
              <input type="number" step="0.01" min="0.01" className="input" value={monto} onChange={e => setMonto(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Motivo (destino que dará al vale)</label>
            <input className="input" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. Constitución de Caja Chica" />
          </div>

          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider pt-1">Solicitante / Responsable del Vale</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="label">Nombres y apellidos</label>
              <input className="input" value={solNombre} onChange={e => setSolNombre(e.target.value)} />
            </div>
            <div>
              <label className="label">No. Empleado</label>
              <input className="input font-mono" value={solEmpleado} onChange={e => setSolEmpleado(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">NIT</label>
              <input className="input font-mono" value={solNit} onChange={e => setSolNit(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Jefe de la Dependencia</p>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={mismoJefe} onChange={e => setMismoJefe(e.target.checked)} className="w-3.5 h-3.5 accent-brand-600" />
              Es la misma persona
            </label>
          </div>
          {!mismoJefe && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3">
                <label className="label">Nombres y apellidos</label>
                <input className="input" value={jefeNombre} onChange={e => setJefeNombre(e.target.value)} />
              </div>
              <div>
                <label className="label">No. Empleado</label>
                <input className="input font-mono" value={jefeEmpleado} onChange={e => setJefeEmpleado(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">NIT</label>
                <input className="input font-mono" value={jefeNit} onChange={e => setJefeNit(e.target.value)} />
              </div>
            </div>
          )}

          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider pt-1">Cheque</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Cheque No.</label>
              <input className="input font-mono" value={cheque} onChange={e => setCheque(e.target.value)} />
            </div>
            <div>
              <label className="label">Fecha emisión</label>
              <input type="date" className="input" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} />
            </div>
            <div>
              <label className="label">Entregado el</label>
              <input type="date" className="input" value={fechaEntregado} onChange={e => setFechaEntregado(e.target.value)} />
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
          <button onClick={handleGuardar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Registrar Vale
          </button>
        </div>
      </div>
    </div>
  );
}
