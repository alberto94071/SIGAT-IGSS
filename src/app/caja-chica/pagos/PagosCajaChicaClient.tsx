"use client";
import { fechaGuatemala } from "@/lib/date-utils";
import { useState, useEffect } from "react";
import { FileCheck, Loader2, CheckCircle2, Wallet, X, Clock, Undo2 } from "lucide-react";
import { liquidarPago } from "@/lib/caja-chica-liquidacion-actions";
import { getValesGastosVariosDisponibles } from "@/lib/vale-actions";
import { devolverAFormaPago, type PagoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import ExpandableRow from "@/components/ExpandableRow";
import TrazabilidadPanel from "@/components/TrazabilidadPanel";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type ValePendiente = { id: number; numero: number; monto: number; solicitante_nombre: string };

interface Props { pagos: PagoFondoRotativo[]; }

export default function PagosCajaChicaClient({ pagos: init }: Props) {
  const [pagos, setPagos] = useState(init);
  const [modalFor, setModalFor] = useState<PagoFondoRotativo | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [procesando, setProcesando] = useState<number | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});

  async function handleDevolver(p: PagoFondoRotativo) {
    if (!confirm("¿Devolver este pago a Fondo Rotativo/Pagos para elegir otra forma de pago? Se deshace el efectivo ya registrado (y lo que ya se posteó en Ejecución)."))
      return;
    setProcesando(p.id); setRowError(prev => ({ ...prev, [p.id]: "" }));
    const res = await devolverAFormaPago(p.id);
    setProcesando(null);
    if ("error" in res) { setRowError(prev => ({ ...prev, [p.id]: res.error })); return; }
    setPagos(prev => prev.filter(x => x.id !== p.id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="w-5 h-5" /> Pagos
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Pagos en efectivo que llegaron de Fondo Rotativo/Pagos. Aquí se les asigna el vale de Caja Chica y se
          confirma el pago — si todavía no hay vale activo, se quedan esperando en esta lista.
        </p>
      </div>

      {pagos.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No hay pagos en efectivo esperando confirmarse.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">No. A-04 SIAF</th>
                  <th className="px-4 py-3 text-left">Destinatario</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Factura</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagos.map(p => (
                  <ExpandableRow key={p.id} colSpan={6}
                    expanded={expandedId === p.id}
                    onToggle={() => setExpandedId(prev => prev === p.id ? null : p.id)}
                    rowClassName="hover:bg-gray-50 cursor-pointer transition-colors"
                    detail={<TrazabilidadPanel
                      titulo={`Detalle de A-04 SIAF ${p.numero_a04 != null ? `${p.numero_a04}/${p.anio_a04}` : ""}`}
                      cadena={[{ label: "FRI", value: p.fri_numero != null ? `${p.fri_numero}/${p.fri_anio}` : null }]}
                      traz={p.traz}
                    />}>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                      {p.numero_a04 != null ? `${p.numero_a04}/${p.anio_a04}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{p.destinatario_nombre ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {p.serie_factura}-{p.no_factura} · {p.fecha_emision_factura}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                      {p.total != null ? Q(p.total) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => handleDevolver(p)} disabled={procesando === p.id}
                          title="Devolver a Fondo Rotativo/Pagos para elegir otra forma de pago"
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50">
                          {procesando === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setModalFor(p)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                          <FileCheck className="w-3 h-3" /> Confirmar pago
                        </button>
                      </div>
                      {rowError[p.id] && <p className="text-[10px] text-red-600 mt-1 max-w-[180px] text-right ml-auto">{rowError[p.id]}</p>}
                    </td>
                  </ExpandableRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalFor && (
        <ConfirmarPagoModal
          pago={modalFor}
          onClose={() => setModalFor(null)}
          onDone={() => { setPagos(p => p.filter(x => x.id !== modalFor.id)); setModalFor(null); }}
        />
      )}
    </div>
  );
}

function ConfirmarPagoModal({ pago, onClose, onDone }: {
  pago: PagoFondoRotativo; onClose: () => void; onDone: () => void;
}) {
  const [fechaPago, setFechaPago] = useState(fechaGuatemala());
  const [vales, setVales] = useState<ValePendiente[] | null>(null);
  const [valeId, setValeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getValesGastosVariosDisponibles().then(r => setVales(r as unknown as ValePendiente[]));
  }, []);

  async function handleConfirmar() {
    if (!valeId || !fechaPago) return;
    setLoading(true); setError("");
    const res = await liquidarPago(pago.id, { fecha_pago: fechaPago, vale_id: valeId });
    setLoading(false);
    if ("error" in res) { setError(res.error); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-brand-600" /> Confirmar pago en efectivo
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="label">Fecha de pago</label>
            <input type="date" className="input" value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
          </div>
          <div>
            <label className="label">Vale de Caja Chica</label>
            {vales === null ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : vales.length === 0 ? (
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2.5">
                <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Todavía no hay vale de gastos varios activo — este pago se queda esperando aquí hasta que se genere uno en Caja Chica/Vale.</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {vales.map(v => (
                  <label key={v.id}
                    className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer ${valeId === v.id ? "bg-brand-50" : "bg-white"}`}>
                    <input type="radio" name="vale" checked={valeId === v.id} onChange={() => setValeId(v.id)} className="w-4 h-4 accent-brand-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-bold text-gray-900">{String(v.numero).padStart(7, "0")}</p>
                      <p className="text-xs text-gray-400 truncate">{v.solicitante_nombre}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 shrink-0">{Q(v.monto)}</p>
                  </label>
                ))}
              </div>
            )}
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleConfirmar} disabled={loading || !valeId || !fechaPago} className="btn-primary disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />} Confirmar pago
          </button>
        </div>
      </div>
    </div>
  );
}
