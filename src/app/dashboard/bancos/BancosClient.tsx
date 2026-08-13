"use client";
import { useState } from "react";
import { fechaGuatemala } from "@/lib/date-utils";
import Link from "next/link";
import { Landmark, X, Loader2, Send, CheckCircle2, Printer, FileEdit } from "lucide-react";
import { completarVoucherBancos, type PagoFondoRotativo, type TipoDocumentoPago } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import { montoEnLetras } from "@/lib/adjudicacion/deletreo";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props { pagos: PagoFondoRotativo[]; }

export default function BancosClient({ pagos: init }: Props) {
  const [pagos, setPagos] = useState(init);
  const [modalFor, setModalFor] = useState<PagoFondoRotativo | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Landmark className="w-5 h-5" /> Fondo Rotativo — Bancos
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {pagos.length} pago(s) por cheque. Completa el número de cheque y los datos del Voucher para poder imprimirlo.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">No. A-04 SIAF</th>
                <th className="px-4 py-3 text-left">Destinatario</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Factura</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Cheque</th>
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
                  <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{p.numero_cheque ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                    {p.total != null ? Q(p.total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {p.numero_cheque == null ? (
                      <button onClick={() => setModalFor(p)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors ml-auto">
                        <FileEdit className="w-3 h-3" /> Completar datos
                      </button>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setModalFor(p)}
                          title="Corregir datos"
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                          <FileEdit className="w-4 h-4" />
                        </button>
                        <Link href={`/dashboard/bancos/${p.id}/imprimir`}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                          <Printer className="w-3 h-3" /> Imprimir Voucher
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagos.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay pagos con cheque enviados a Bancos todavía.</p>
            </div>
          )}
        </div>
      </div>

      {modalFor && (
        <CompletarVoucherModal
          pago={modalFor}
          onClose={() => setModalFor(null)}
          onDone={(pagoActualizado) => {
            setPagos(p => p.map(x => x.id === pagoActualizado.id ? pagoActualizado : x));
            setModalFor(null);
          }}
        />
      )}
    </div>
  );
}

function CompletarVoucherModal({ pago: p, onClose, onDone }: {
  pago: PagoFondoRotativo; onClose: () => void; onDone: (pago: PagoFondoRotativo) => void;
}) {
  const [numeroCheque, setNumeroCheque] = useState(p.numero_cheque ?? "");
  const [fechaEmisionCheque, setFechaEmisionCheque] = useState(p.fecha_emision_cheque ?? fechaGuatemala());
  const [tipoDocumentoPago, setTipoDocumentoPago] = useState<TipoDocumentoPago | "">(p.tipo_documento_pago as TipoDocumentoPago ?? "Factura");
  const [nitBeneficiario, setNitBeneficiario] = useState(p.nit_beneficiario ?? "");
  const [destinatarioNombre, setDestinatarioNombre] = useState(p.destinatario_nombre ?? "");
  const [montoCheque, setMontoCheque] = useState(String(p.monto_cheque ?? p.total ?? ""));
  const [montoLetras, setMontoLetras] = useState(p.monto_letras ?? (p.total ? montoEnLetras(p.total) : ""));
  const [conceptoVoucher, setConceptoVoucher] = useState(p.concepto_voucher ?? `A-04 No. ${p.numero_a04 ?? ""}/${p.anio_a04 ?? ""}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function onMontoChange(v: string) {
    setMontoCheque(v);
    const n = Number(v);
    if (n > 0) setMontoLetras(montoEnLetras(n));
  }

  async function handleGuardar() {
    const monto = Number(montoCheque);
    setLoading(true); setError("");
    const res = await completarVoucherBancos(p.id, {
      numero_cheque: numeroCheque.trim(), fecha_emision_cheque: fechaEmisionCheque,
      tipo_documento_pago: tipoDocumentoPago as TipoDocumentoPago,
      nit_beneficiario: nitBeneficiario.trim(), destinatario_nombre: destinatarioNombre.trim(),
      monto_cheque: monto, monto_letras: montoLetras.trim(), concepto_voucher: conceptoVoucher.trim(),
    });
    setLoading(false);
    if ("error" in res) { setError(res.error); return; }
    onDone({
      ...p,
      numero_cheque: numeroCheque.trim(), fecha_emision_cheque: fechaEmisionCheque,
      tipo_documento_pago: tipoDocumentoPago, nit_beneficiario: nitBeneficiario.trim(),
      destinatario_nombre: destinatarioNombre.trim(), monto_cheque: monto,
      monto_letras: montoLetras.trim(), concepto_voucher: conceptoVoucher.trim(),
    });
  }

  const valido = numeroCheque.trim() && fechaEmisionCheque && tipoDocumentoPago
    && nitBeneficiario.trim() && destinatarioNombre.trim() && Number(montoCheque) > 0 && montoLetras.trim();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-brand-600" /> Completar cheque y Voucher
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 grid grid-cols-2 gap-3">
          <div>
            <label className="label">No. de cheque</label>
            <input className="input font-mono" value={numeroCheque} onChange={e => setNumeroCheque(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Fecha de emisión</label>
            <input type="date" className="input" value={fechaEmisionCheque} onChange={e => setFechaEmisionCheque(e.target.value)} />
          </div>
          <div>
            <label className="label">Tipo de documento</label>
            <select className="input" value={tipoDocumentoPago} onChange={e => setTipoDocumentoPago(e.target.value as TipoDocumentoPago)}>
              <option value="Factura">Factura</option>
              <option value="Vale">Vale</option>
              <option value="Formulario">Formulario</option>
            </select>
          </div>
          <div>
            <label className="label">NIT del beneficiario</label>
            <input className="input font-mono" value={nitBeneficiario} onChange={e => setNitBeneficiario(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Nombre del beneficiario</label>
            <input className="input" value={destinatarioNombre} onChange={e => setDestinatarioNombre(e.target.value)} />
          </div>
          <div>
            <label className="label">Monto (Q)</label>
            <input type="number" step="0.01" className="input font-mono" value={montoCheque} onChange={e => onMontoChange(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Cantidad (en letras)</label>
            <input className="input" value={montoLetras} onChange={e => setMontoLetras(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Concepto (Voucher)</label>
            <input className="input" value={conceptoVoucher} onChange={e => setConceptoVoucher(e.target.value)} />
          </div>
          {error && (
            <div className="col-span-2 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleGuardar} disabled={loading || !valido} className="btn-primary disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
