"use client";
import { fechaGuatemala } from "@/lib/date-utils";

import { useState } from "react";
import Link from "next/link";
import { FileText, Printer, X, Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { aceptarSolicitudPasaje, rechazarSolicitudPasaje } from "@/lib/pasajes-actions";

type Solicitud = {
  id: number; numero: number; fecha: string; afiliacion: string; nombre_afiliado: string;
  tramo: string; punto_partida: string; destino: string;
};
type Pago = {
  id: number; formulario_no: number; fecha_pago: string; afiliacion: string; nombre_afiliado: string;
};

export default function Dpd23BandejaClient({
  pendientes: init, pagos, canEdit,
}: { pendientes: Solicitud[]; pagos: Pago[]; canEdit: boolean }) {
  const [pendientes, setPendientes] = useState(init);
  const [generados, setGenerados] = useState(pagos);
  const [aceptando, setAceptando] = useState<Solicitud | null>(null);
  const [rechazando, setRechazando] = useState<Solicitud | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5" /> DPD-23 — Recibo de Gastos de Transporte
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Acepta o rechaza cada solicitud (SPS-75) para generar su recibo de pago.</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Solicitudes pendientes de generar DPD-23</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left whitespace-nowrap">SPS-75</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Afiliación</th>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-left">Ruta</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Tramo</th>
                  {canEdit && <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendientes.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{String(s.numero).padStart(4, "0")}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.fecha}</td>
                    <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{s.afiliacion}</td>
                    <td className="px-4 py-3 text-gray-700">{s.nombre_afiliado}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{s.punto_partida} → {s.destino}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.tramo}</td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => setRechazando(s)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
                            <XCircle className="w-3 h-3" /> Rechazar
                          </button>
                          <button onClick={() => setAceptando(s)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                            <CheckCircle2 className="w-3 h-3" /> Aceptar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {pendientes.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">No hay solicitudes pendientes.</div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">DPD-23 generados</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left whitespace-nowrap">Formulario</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Afiliación</th>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {generados.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{String(p.formulario_no).padStart(4, "0")}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.fecha_pago}</td>
                    <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{p.afiliacion}</td>
                    <td className="px-4 py-3 text-gray-700">{p.nombre_afiliado}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/pasajes/dpd-23/${p.formulario_no}`}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors ml-auto w-fit">
                        <Printer className="w-3 h-3" /> Imprimir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {generados.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">Aún no se ha generado ningún DPD-23.</div>
            )}
          </div>
        </div>
      </div>

      {aceptando && (
        <AceptarModal
          solicitud={aceptando}
          onClose={() => setAceptando(null)}
          onAceptado={(formularioNo) => {
            setPendientes(prev => prev.filter(s => s.id !== aceptando.id));
            setGenerados(prev => [{ id: formularioNo, formulario_no: formularioNo, fecha_pago: fechaGuatemala(), afiliacion: aceptando.afiliacion, nombre_afiliado: aceptando.nombre_afiliado }, ...prev]);
            setAceptando(null);
          }}
        />
      )}
      {rechazando && (
        <RechazarModal
          solicitud={rechazando}
          onClose={() => setRechazando(null)}
          onRechazado={() => {
            setPendientes(prev => prev.filter(s => s.id !== rechazando.id));
            setRechazando(null);
          }}
        />
      )}
    </div>
  );
}

function AceptarModal({ solicitud, onClose, onAceptado }: { solicitud: Solicitud; onClose: () => void; onAceptado: (formularioNo: number) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState<number | null>(null);

  async function handleAceptar() {
    setSaving(true); setError("");
    const res = await aceptarSolicitudPasaje(solicitud.id);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    setListo(res.formulario_no);
  }

  if (listo != null) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center space-y-4">
          <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
          <p className="text-gray-900 font-semibold">DPD-23 generado</p>
          <div className="flex justify-center gap-2">
            <button onClick={onClose} className="btn-secondary">Cerrar</button>
            <Link href={`/pasajes/dpd-23/${listo}`} onClick={() => onAceptado(listo)}
              className="btn-primary flex items-center gap-2">
              <Printer className="w-4 h-4" /> Imprimir DPD-23
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Aceptar solicitud {String(solicitud.numero).padStart(4, "0")}</h2>
        <p className="text-sm text-gray-600">
          <strong>{solicitud.nombre_afiliado}</strong> — {solicitud.punto_partida} → {solicitud.destino} ({solicitud.tramo})
        </p>
        <p className="text-sm text-gray-500">Se generará el DPD-23 con estos datos.</p>
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleAceptar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}

function RechazarModal({ solicitud, onClose, onRechazado }: { solicitud: Solicitud; onClose: () => void; onRechazado: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleRechazar() {
    if (!motivo.trim()) return setError("El motivo del rechazo es obligatorio");
    setSaving(true); setError("");
    const res = await rechazarSolicitudPasaje(solicitud.id, motivo);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onRechazado();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Rechazar solicitud {String(solicitud.numero).padStart(4, "0")}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-gray-600">
          <strong>{solicitud.nombre_afiliado}</strong> — {solicitud.punto_partida} → {solicitud.destino}
        </p>
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
