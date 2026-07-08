"use client";
import { useState } from "react";
import Link from "next/link";
import { FileText, Printer, X, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { generarDpd23DesdeSolicitud, type GenerarDpd23Data } from "@/lib/pasajes-actions";

type Solicitud = {
  id: number; numero: number; fecha: string; afiliacion: string; nombre_afiliado: string;
  tramo: string; punto_partida: string; destino: string;
};
type Vale = { id: number; numero: number; monto: number; solicitante_nombre: string };
type Pago = {
  id: number; formulario_no: number; fecha_pago: string; afiliacion: string; nombre_afiliado: string;
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Dpd23BandejaClient({
  pendientes: init, pagos, vales, canEdit,
}: { pendientes: Solicitud[]; pagos: Pago[]; vales: Vale[]; canEdit: boolean }) {
  const [pendientes, setPendientes] = useState(init);
  const [generados, setGenerados] = useState(pagos);
  const [modal, setModal] = useState<Solicitud | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5" /> DPD-23 — Recibo de Gastos de Transporte
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Genera el recibo de pago a partir de una solicitud (SPS-75) ya autorizada.</p>
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
                        <button onClick={() => setModal(s)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                          Generar DPD-23
                        </button>
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
                      <Link href={`/caja-chica/sps-23/${p.formulario_no}`}
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

      {modal && (
        <GenerarDpd23Modal
          solicitud={modal}
          vales={vales}
          onClose={() => setModal(null)}
          onGenerado={(formularioNo) => {
            setPendientes(prev => prev.filter(s => s.id !== modal.id));
            setGenerados(prev => [{ id: formularioNo, formulario_no: formularioNo, fecha_pago: new Date().toISOString().slice(0, 10), afiliacion: modal.afiliacion, nombre_afiliado: modal.nombre_afiliado }, ...prev]);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function GenerarDpd23Modal({
  solicitud, vales, onClose, onGenerado,
}: { solicitud: Solicitud; vales: Vale[]; onClose: () => void; onGenerado: (formularioNo: number) => void }) {
  const [fechaCita, setFechaCita] = useState("");
  const [polizaNo, setPolizaNo] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [valeId, setValeId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState<number | null>(null);

  async function handleGenerar() {
    if (!chequeNo.trim()) return setError("El número de cheque es obligatorio");
    if (!valeId) return setError("Selecciona el número de vale");

    const data: GenerarDpd23Data = { fecha_cita: fechaCita, poliza_no: polizaNo ? Number(polizaNo) : null, cheque_no: chequeNo, vale_id: valeId };
    setSaving(true); setError("");
    const res = await generarDpd23DesdeSolicitud(solicitud.id, data);
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
            <Link href={`/caja-chica/sps-23/${listo}`} onClick={() => onGenerado(listo)}
              className="btn-primary flex items-center gap-2">
              <Printer className="w-4 h-4" /> Imprimir DPD-23
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Generar DPD-23 — Solicitud {String(solicitud.numero).padStart(4, "0")}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            <strong>{solicitud.nombre_afiliado}</strong> — {solicitud.punto_partida} → {solicitud.destino} ({solicitud.tramo})
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha de Cita</label>
              <input type="date" className="input" value={fechaCita} onChange={e => setFechaCita(e.target.value)} />
            </div>
            <div>
              <label className="label">Póliza No.</label>
              <input type="number" className="input" value={polizaNo} onChange={e => setPolizaNo(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Cheque No.</label>
            <input className="input font-mono" value={chequeNo} onChange={e => setChequeNo(e.target.value)} />
          </div>

          <div>
            <label className="label">Vale de Caja Chica</label>
            {vales.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                No hay vales pendientes. Debes generarlo primero en Caja Chica/Vale.
              </p>
            ) : (
              <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                {vales.map(v => (
                  <label key={v.id}
                    className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer ${valeId === v.id ? "bg-brand-50" : "bg-white"}`}>
                    <input type="radio" name="vale" checked={valeId === v.id} onChange={() => setValeId(v.id)} className="w-4 h-4 accent-brand-600" />
                    <div className="flex-1 text-sm">
                      <p className="font-mono font-semibold text-gray-900">{String(v.numero).padStart(7, "0")}</p>
                      <p className="text-xs text-gray-500">{v.solicitante_nombre}</p>
                    </div>
                    <span className="font-mono text-sm font-bold text-green-700">{Q(v.monto)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleGenerar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Generar DPD-23
          </button>
        </div>
      </div>
    </div>
  );
}
