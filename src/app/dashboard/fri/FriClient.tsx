"use client";
import { fechaGuatemala } from "@/lib/date-utils";

import { useState } from "react";
import Link from "next/link";
import { Wallet, Printer, ChevronDown, ChevronRight, Loader2, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { conformarFri, marcarFriReintegrado, getFriConDetalle, type Fri } from "@/lib/fri-actions";
import type { PagoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FriClient({
  pendientes: init, fris: initFris,
}: { pendientes: PagoFondoRotativo[]; fris: Fri[] }) {
  const [pendientes, setPendientes] = useState(init);
  const [fris, setFris] = useState(initFris);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [conformando, setConformando] = useState(false);
  const [errorConformar, setErrorConformar] = useState("");
  const [expandido, setExpandido] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Record<number, PagoFondoRotativo[]>>({});
  const [reintegrarFor, setReintegrarFor] = useState<Fri | null>(null);

  function toggle(id: number) {
    setSeleccion(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function toggleExpandir(id: number) {
    if (expandido === id) { setExpandido(null); return; }
    setExpandido(id);
    if (!detalle[id]) {
      const res = await getFriConDetalle(id);
      if (res) setDetalle(prev => ({ ...prev, [id]: res.items }));
    }
  }

  async function handleConformar() {
    if (seleccion.size === 0) return;
    setConformando(true); setErrorConformar("");
    const ids = Array.from(seleccion);
    const res = await conformarFri(ids);
    setConformando(false);
    if ("error" in res) return setErrorConformar(res.error);

    setFris(prev => [res.fri, ...prev]);
    setPendientes(prev => prev.filter(p => !ids.includes(p.id)));
    setSeleccion(new Set());
  }

  const totalSeleccion = pendientes.filter(p => seleccion.has(p.id)).reduce((s, p) => s + (p.total ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="w-5 h-5" /> Pago/FRI
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Pagos de renglones 100-199 ya realizados (cheque o vale) — agrúpalos en un FRI para pedir el reintegro a Fondo Rotativo.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Pagos sin FRI conformado</h2>
          {seleccion.size > 0 && (
            <button onClick={handleConformar} disabled={conformando}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
              {conformando ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Conformar FRI ({seleccion.size} · {Q(totalSeleccion)})
            </button>
          )}
        </div>
        {errorConformar && (
          <div className="mb-2 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{errorConformar}
          </div>
        )}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">No. A-04 SIAF</th>
                  <th className="px-4 py-3 text-left">Destinatario</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Forma de pago</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Factura</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendientes.map(p => (
                  <tr key={p.id} className={`hover:bg-gray-50 ${seleccion.has(p.id) ? "bg-brand-50" : ""}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={seleccion.has(p.id)} onChange={() => toggle(p.id)} className="w-4 h-4 accent-brand-600" />
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                      {p.numero_a04 != null ? `${p.numero_a04}/${p.anio_a04}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{p.destinatario_nombre ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {p.forma_pago === "cheque" ? `Cheque ${p.numero_cheque ?? ""}` : `Vale ${p.numero_vale ?? ""}`}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {p.serie_factura}-{p.no_factura} · {p.fecha_emision_factura}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                      {p.total != null ? Q(p.total) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pendientes.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">No hay pagos pendientes de conformar en un FRI.</div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">FRIs conformados</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">FRI No.</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Fecha reintegro</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fris.map(f => (
                  <>
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button onClick={() => toggleExpandir(f.id)} className="text-gray-400 hover:text-gray-700">
                          {expandido === f.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">FRI {f.numero}/{f.anio}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          f.estado === "Reintegrado" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {f.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.fecha_reintegro ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">{Q(f.total)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {f.estado === "Generado" && (
                            <button onClick={() => setReintegrarFor(f)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700">
                              <CheckCircle2 className="w-3 h-3" /> Marcar Reintegrado
                            </button>
                          )}
                          <Link href={`/dashboard/fri/${f.numero}?anio=${f.anio}`}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
                            <Printer className="w-3 h-3" /> Imprimir
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {expandido === f.id && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 bg-gray-50">
                          {!detalle[f.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500">
                                  <th className="text-left py-1">A-04 SIAF</th>
                                  <th className="text-left py-1">Destinatario</th>
                                  <th className="text-left py-1">Forma de pago</th>
                                  <th className="text-left py-1">Factura</th>
                                  <th className="text-right py-1">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detalle[f.id].map(i => (
                                  <tr key={i.id} className="border-t border-gray-200">
                                    <td className="py-1.5 font-mono">{i.numero_a04 != null ? `${i.numero_a04}/${i.anio_a04}` : "—"}</td>
                                    <td className="py-1.5">{i.destinatario_nombre ?? "—"}</td>
                                    <td className="py-1.5">{i.forma_pago === "cheque" ? `Cheque ${i.numero_cheque ?? ""}` : `Vale ${i.numero_vale ?? ""}`}</td>
                                    <td className="py-1.5">{i.serie_factura}-{i.no_factura}</td>
                                    <td className="py-1.5 text-right font-mono">{i.total != null ? Q(i.total) : "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
            {fris.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">Aún no se ha conformado ningún FRI.</div>
            )}
          </div>
        </div>
      </div>

      {reintegrarFor && (
        <ReintegrarModal
          fri={reintegrarFor}
          onClose={() => setReintegrarFor(null)}
          onDone={() => {
            setFris(prev => prev.map(f => f.id === reintegrarFor.id
              ? { ...f, estado: "Reintegrado", fecha_reintegro: reintegrarFor.fecha_reintegro ?? fechaGuatemala() } : f));
            setReintegrarFor(null);
          }}
        />
      )}
    </div>
  );
}

function ReintegrarModal({ fri, onClose, onDone }: { fri: Fri; onClose: () => void; onDone: () => void }) {
  const [fecha, setFecha] = useState(fechaGuatemala());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirmar() {
    setLoading(true); setError("");
    const res = await marcarFriReintegrado(fri.id, fecha);
    setLoading(false);
    if ("error" in res) return setError(res.error);
    fri.fecha_reintegro = fecha;
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Reintegro — FRI {fri.numero}/{fri.anio}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-600">
            Al confirmar, se suman <strong>{Q(fri.total)}</strong> al saldo disponible del Fondo Rotativo.
          </p>
          <div>
            <label className="label">Fecha del depósito de reintegro</label>
            <input type="date" className="input" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleConfirmar} disabled={loading || !fecha} className="btn-primary disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Marcar como Reintegrado
          </button>
        </div>
      </div>
    </div>
  );
}
