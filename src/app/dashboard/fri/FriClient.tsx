"use client";
import { fechaGuatemala } from "@/lib/date-utils";

import { useState } from "react";
import Link from "next/link";
import { Wallet, Printer, ChevronDown, ChevronRight, Loader2, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { conformarFri, marcarFriReintegrado, enviarFriADaf, marcarFriRechazado, getFriConDetalle, type Fri, type PolizaFri, type FriItemInput } from "@/lib/fri-actions";
import type { PagoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Row = { key: string; item: FriItemInput; origen: string; referencia: string; detalle: string; total: number };

function pagoARow(p: PagoFondoRotativo): Row {
  return {
    key: `pago:${p.id}`, item: { tipo: "pago", id: p.id }, origen: "Gastos Varios",
    referencia: p.numero_a04 != null ? `A-04 ${p.numero_a04}/${p.anio_a04}` : "—",
    detalle: `${p.destinatario_nombre ?? "—"} · ${p.forma_pago === "cheque" ? `Cheque ${p.numero_cheque ?? ""}` : `Vale ${p.numero_vale ?? ""}`}`,
    total: p.total ?? 0,
  };
}
function polizaARow(p: PolizaFri): Row {
  return {
    key: `poliza:${p.id}`, item: { tipo: "poliza", id: p.id }, origen: "Pasajes",
    referencia: `Póliza ${p.numero}`,
    detalle: `Cuadro de Caja del ${p.fecha} · ${p.estado}`,
    total: p.total,
  };
}

export default function FriClient({
  pendientesPagos: initPagos, pendientesPolizas: initPolizas, fris: initFris,
}: { pendientesPagos: PagoFondoRotativo[]; pendientesPolizas: PolizaFri[]; fris: Fri[] }) {
  const [pendientesPagos, setPendientesPagos] = useState(initPagos);
  const [pendientesPolizas, setPendientesPolizas] = useState(initPolizas);
  const [fris, setFris] = useState(initFris);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [conformando, setConformando] = useState(false);
  const [errorConformar, setErrorConformar] = useState("");
  const [expandido, setExpandido] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Record<number, { pagos: PagoFondoRotativo[]; polizas: PolizaFri[] }>>({});
  const [reintegrarFor, setReintegrarFor] = useState<Fri | null>(null);
  const [enviarFor, setEnviarFor] = useState<Fri | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});
  const [rechazando, setRechazando] = useState<number | null>(null);

  async function handleRechazar(f: Fri) {
    setRechazando(f.id); setRowError(prev => ({ ...prev, [f.id]: "" }));
    const res = await marcarFriRechazado(f.id);
    setRechazando(null);
    if ("error" in res) { setRowError(prev => ({ ...prev, [f.id]: res.error })); return; }
    setFris(prev => prev.map(x => x.id === f.id ? { ...x, estado: "Rechazado" } : x));
  }

  const filas: Row[] = [...pendientesPagos.map(pagoARow), ...pendientesPolizas.map(polizaARow)];

  function toggle(key: string) {
    setSeleccion(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function toggleExpandir(id: number) {
    if (expandido === id) { setExpandido(null); return; }
    setExpandido(id);
    if (!detalle[id]) {
      const res = await getFriConDetalle(id);
      if (res) setDetalle(prev => ({ ...prev, [id]: { pagos: res.pagos, polizas: res.polizas } }));
    }
  }

  async function handleConformar() {
    if (seleccion.size === 0) return;
    setConformando(true); setErrorConformar("");
    const items = filas.filter(f => seleccion.has(f.key)).map(f => f.item);
    const res = await conformarFri(items);
    setConformando(false);
    if ("error" in res) return setErrorConformar(res.error);

    setFris(prev => [res.fri, ...prev]);
    const pagoIds = new Set(items.filter(i => i.tipo === "pago").map(i => i.id));
    const polizaIds = new Set(items.filter(i => i.tipo === "poliza").map(i => i.id));
    setPendientesPagos(prev => prev.filter(p => !pagoIds.has(p.id)));
    setPendientesPolizas(prev => prev.filter(p => !polizaIds.has(p.id)));
    setSeleccion(new Set());
  }

  const totalSeleccion = filas.filter(f => seleccion.has(f.key)).reduce((s, f) => s + f.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="w-5 h-5" /> Pago/FRI
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Gastos ya realizados (renglones 100-199 pagados por cheque/vale, y pólizas de pasajes) — agrúpalos en un
          FRI para reportar en qué se gastó y pedir el reintegro a Fondo Rotativo. Conformar un FRI no cambia el
          camino normal de liquidación de las pólizas.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Pendientes de conformar FRI</h2>
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
                  <th className="px-4 py-3 text-left whitespace-nowrap">Origen</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Referencia</th>
                  <th className="px-4 py-3 text-left">Detalle</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filas.map(f => (
                  <tr key={f.key} className={`hover:bg-gray-50 ${seleccion.has(f.key) ? "bg-brand-50" : ""}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={seleccion.has(f.key)} onChange={() => toggle(f.key)} className="w-4 h-4 accent-brand-600" />
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.origen}</td>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{f.referencia}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{f.detalle}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">{Q(f.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filas.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">No hay pagos ni pólizas pendientes de conformar en un FRI.</div>
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
                  <th className="px-4 py-3 text-left whitespace-nowrap">Envío a DAF</th>
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
                          f.estado === "Reintegrado" ? "bg-green-100 text-green-700"
                            : f.estado === "Enviado" ? "bg-blue-100 text-blue-700"
                            : f.estado === "Rechazado" ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {f.estado}
                        </span>
                        {rowError[f.id] && <p className="text-[10px] text-red-600 mt-1 max-w-[160px]">{rowError[f.id]}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.fecha_envio_daf ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.fecha_reintegro ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">{Q(f.total)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {(f.estado === "Generado" || f.estado === "Rechazado") && (
                            <button onClick={() => setEnviarFor(f)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700">
                              Enviar a DAF
                            </button>
                          )}
                          {f.estado === "Enviado" && (
                            <>
                              <button onClick={() => handleRechazar(f)} disabled={rechazando === f.id}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50">
                                {rechazando === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Rechazar
                              </button>
                              <button onClick={() => setReintegrarFor(f)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700">
                                <CheckCircle2 className="w-3 h-3" /> Marcar Reintegrado
                              </button>
                            </>
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
                        <td colSpan={7} className="px-4 py-3 bg-gray-50">
                          {!detalle[f.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500">
                                  <th className="text-left py-1">Origen</th>
                                  <th className="text-left py-1">Referencia</th>
                                  <th className="text-left py-1">Detalle</th>
                                  <th className="text-right py-1">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...detalle[f.id].pagos.map(pagoARow), ...detalle[f.id].polizas.map(polizaARow)].map(r => (
                                  <tr key={r.key} className="border-t border-gray-200">
                                    <td className="py-1.5">{r.origen}</td>
                                    <td className="py-1.5 font-mono">{r.referencia}</td>
                                    <td className="py-1.5">{r.detalle}</td>
                                    <td className="py-1.5 text-right font-mono">{Q(r.total)}</td>
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

      {enviarFor && (
        <EnviarDafModal
          fri={enviarFor}
          onClose={() => setEnviarFor(null)}
          onDone={(fecha) => {
            setFris(prev => prev.map(f => f.id === enviarFor.id
              ? { ...f, estado: "Enviado", fecha_envio_daf: fecha } : f));
            setEnviarFor(null);
          }}
        />
      )}
    </div>
  );
}

function EnviarDafModal({ fri, onClose, onDone }: { fri: Fri; onClose: () => void; onDone: (fecha: string) => void }) {
  const [fecha, setFecha] = useState(fechaGuatemala());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirmar() {
    setLoading(true); setError("");
    const res = await enviarFriADaf(fri.id, fecha);
    setLoading(false);
    if ("error" in res) return setError(res.error);
    onDone(fecha);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Enviar a DAF — FRI {fri.numero}/{fri.anio}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="label">Fecha de envío a la DAF</label>
            <input type="date" className="input" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleConfirmar} disabled={loading || !fecha} className="btn-primary disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Enviar a DAF
          </button>
        </div>
      </div>
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
