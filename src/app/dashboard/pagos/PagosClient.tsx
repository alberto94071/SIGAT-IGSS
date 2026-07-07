"use client";
import { useState } from "react";
import { Wallet, Loader2, CheckCircle2, X, Banknote, Coins } from "lucide-react";
import { registrarFormaPagoCheque, registrarFormaPagoEfectivo, type PagoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props { pagos: PagoFondoRotativo[]; }

export default function PagosClient({ pagos: init }: Props) {
  const [pagos, setPagos] = useState(init);
  const [modalFor, setModalFor] = useState<PagoFondoRotativo | null>(null);

  if (pagos.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-lg mx-auto mt-10">
        <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Sin pagos pendientes</h2>
        <p className="text-sm text-gray-500">No hay SIAF-04 esperando forma de pago.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="w-5 h-5" /> Fondo Rotativo — Pagos
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{pagos.length} pago(s) esperando forma de pago</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">No. A-04 SIAF</th>
                <th className="px-4 py-3 text-left">Destinatario</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Factura</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagos.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
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
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setModalFor(p)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors ml-auto">
                      <Wallet className="w-3 h-3" /> Agregar forma de pago
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalFor && (
        <FormaPagoModal
          pago={modalFor}
          onClose={() => setModalFor(null)}
          onDone={() => { setPagos(p => p.filter(x => x.id !== modalFor.id)); setModalFor(null); }}
        />
      )}
    </div>
  );
}

function FormaPagoModal({ pago, onClose, onDone }: {
  pago: PagoFondoRotativo; onClose: () => void; onDone: () => void;
}) {
  const [forma, setForma] = useState<"cheque" | "efectivo" | null>(null);
  const [numeroCheque, setNumeroCheque] = useState("");
  const [fechaEmisionCheque, setFechaEmisionCheque] = useState(new Date().toISOString().slice(0, 10));
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [numeroVale, setNumeroVale] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirmar() {
    setLoading(true); setError("");
    const res = forma === "cheque"
      ? await registrarFormaPagoCheque(pago.id, { numero_cheque: numeroCheque.trim(), fecha_emision_cheque: fechaEmisionCheque })
      : await registrarFormaPagoEfectivo(pago.id, { fecha_pago: fechaPago, numero_vale: numeroVale.trim() });
    setLoading(false);
    if ("error" in res) { setError(res.error); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-brand-600" /> Forma de pago
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {forma === null && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setForma("cheque")}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 hover:border-brand-300 text-sm font-medium text-gray-700">
                <Banknote className="w-5 h-5" /> Cheque
              </button>
              <button onClick={() => setForma("efectivo")}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 hover:border-brand-300 text-sm font-medium text-gray-700">
                <Coins className="w-5 h-5" /> Efectivo
              </button>
            </div>
          )}

          {forma === "cheque" && (
            <div className="space-y-3">
              <div>
                <label className="label">No. de cheque</label>
                <input className="input font-mono" value={numeroCheque} onChange={e => setNumeroCheque(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="label">Fecha de emisión</label>
                <input type="date" className="input" value={fechaEmisionCheque} onChange={e => setFechaEmisionCheque(e.target.value)} />
              </div>
              <div>
                <label className="label">Destinatario</label>
                <input className="input bg-gray-50" value={pago.destinatario_nombre ?? ""} readOnly />
              </div>
            </div>
          )}

          {forma === "efectivo" && (
            <div className="space-y-3">
              <div>
                <label className="label">Fecha de pago</label>
                <input type="date" className="input" value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
              </div>
              <div>
                <label className="label">No. de vale</label>
                <input className="input font-mono" value={numeroVale} onChange={e => setNumeroVale(e.target.value)} autoFocus />
              </div>
            </div>
          )}

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          {forma !== null && <button onClick={() => setForma(null)} className="btn-secondary">Atrás</button>}
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          {forma === "cheque" && (
            <button onClick={handleConfirmar} disabled={loading || !numeroCheque.trim() || !fechaEmisionCheque} className="btn-primary disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />} Enviar a Bancos
            </button>
          )}
          {forma === "efectivo" && (
            <button onClick={handleConfirmar} disabled={loading || !numeroVale.trim() || !fechaPago} className="btn-primary disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />} Enviar a Libro Caja Chica
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
