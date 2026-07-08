"use client";
import { useState } from "react";
import Link from "next/link";
import { FileCheck, Printer, ChevronDown, ChevronRight, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { generarPoliza, asignarValeYEnviarALiquidar, getPolizaConDetalle } from "@/lib/poliza-actions";

type Dpd23 = {
  id: number; formulario_no: number; fecha_pago: string; afiliacion: string; nombre_afiliado: string;
  punto_partida: string; destino: string; valor_pasaje: number;
};
type Poliza = {
  id: number; numero: number; fecha: string; total: number; estado: string; vale_id: number | null;
};
type Vale = { id: number; numero: number; monto: number; monto_autorizado: number | null; estado: string } | null;
type Item = { formulario_no: number; nombre_afiliado: string; destino: string; valor_pasaje: number; calidad: string | null };

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PolizaClient({
  dpd23SinPoliza: init, polizas: initP, valeActivo, canEdit,
}: { dpd23SinPoliza: Dpd23[]; polizas: Poliza[]; valeActivo: Vale; canEdit: boolean }) {
  const [dpd23SinPoliza, setDpd23SinPoliza] = useState(init);
  const [polizas, setPolizas] = useState(initP);
  const [seleccionDpd23, setSeleccionDpd23] = useState<Set<number>>(new Set());
  const [seleccionPolizas, setSeleccionPolizas] = useState<Set<number>>(new Set());
  const [generando, setGenerando] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [errorGenerar, setErrorGenerar] = useState("");
  const [errorAsignar, setErrorAsignar] = useState("");
  const [expandido, setExpandido] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Record<number, Item[]>>({});

  function toggleDpd23(id: number) {
    setSeleccionDpd23(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function togglePoliza(id: number) {
    setSeleccionPolizas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function toggleExpandir(id: number) {
    if (expandido === id) { setExpandido(null); return; }
    setExpandido(id);
    if (!detalle[id]) {
      const res = await getPolizaConDetalle(id);
      if (res) setDetalle(prev => ({ ...prev, [id]: res.items }));
    }
  }

  async function handleGenerarPoliza() {
    if (seleccionDpd23.size === 0) return;
    setGenerando(true); setErrorGenerar("");
    const ids = Array.from(seleccionDpd23);
    const res = await generarPoliza(ids);
    setGenerando(false);
    if ("error" in res) return setErrorGenerar(res.error);

    const incluidos = dpd23SinPoliza.filter(d => ids.includes(d.id));
    const total = incluidos.reduce((s, d) => s + d.valor_pasaje, 0);
    setPolizas(prev => [{ id: res.numero, numero: res.numero, fecha: new Date().toISOString().slice(0, 10), total, estado: "Generada", vale_id: null }, ...prev]);
    setDpd23SinPoliza(prev => prev.filter(d => !ids.includes(d.id)));
    setSeleccionDpd23(new Set());
  }

  async function handleAsignarVale() {
    if (seleccionPolizas.size === 0) return;
    setAsignando(true); setErrorAsignar("");
    const res = await asignarValeYEnviarALiquidar(Array.from(seleccionPolizas));
    setAsignando(false);
    if ("error" in res) return setErrorAsignar(res.error);

    setPolizas(prev => prev.map(p => seleccionPolizas.has(p.id) ? { ...p, estado: "Enviada a Liquidar", vale_id: valeActivo?.id ?? p.vale_id } : p));
    setSeleccionPolizas(new Set());
  }

  const totalSeleccionDpd23 = dpd23SinPoliza.filter(d => seleccionDpd23.has(d.id)).reduce((s, d) => s + d.valor_pasaje, 0);
  const totalSeleccionPolizas = polizas.filter(p => seleccionPolizas.has(p.id)).reduce((s, p) => s + p.total, 0);
  const montoVale = valeActivo ? (valeActivo.monto_autorizado ?? valeActivo.monto) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileCheck className="w-5 h-5" /> Póliza — Cuadro de Caja
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Consolida varios DPD-23 en una póliza y asígnale el vale de pasajes activo para enviarla a liquidar.</p>
      </div>

      {valeActivo ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Vale de pasajes activo: <strong>{String(valeActivo.numero).padStart(7, "0")}</strong> — monto {Q(montoVale)}
          {valeActivo.estado !== "Activo" && <span className="text-amber-700">(esperando cheque)</span>}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No hay un vale de pago de pasajes activo. Genéralo primero en Caja Chica/Vale.
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">DPD-23 sin póliza</h2>
          {canEdit && seleccionDpd23.size > 0 && (
            <button onClick={handleGenerarPoliza} disabled={generando}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
              {generando ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Generar Póliza ({seleccionDpd23.size} · {Q(totalSeleccionDpd23)})
            </button>
          )}
        </div>
        {errorGenerar && (
          <div className="mb-2 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{errorGenerar}
          </div>
        )}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  {canEdit && <th className="px-4 py-3 w-8"></th>}
                  <th className="px-4 py-3 text-left whitespace-nowrap">Formulario</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-left">Ruta</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dpd23SinPoliza.map(d => (
                  <tr key={d.id} className={`hover:bg-gray-50 ${seleccionDpd23.has(d.id) ? "bg-brand-50" : ""}`}>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={seleccionDpd23.has(d.id)} onChange={() => toggleDpd23(d.id)} className="w-4 h-4 accent-brand-600" />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{String(d.formulario_no).padStart(4, "0")}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{d.fecha_pago}</td>
                    <td className="px-4 py-3 text-gray-700">{d.nombre_afiliado}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{d.punto_partida} → {d.destino}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">{Q(d.valor_pasaje)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dpd23SinPoliza.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">No hay DPD-23 pendientes de consolidar.</div>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Pólizas generadas</h2>
          {canEdit && seleccionPolizas.size > 0 && (
            <button onClick={handleAsignarVale} disabled={asignando || !valeActivo}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
              {asignando ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Asignar vale y enviar a liquidar ({Q(totalSeleccionPolizas)})
            </button>
          )}
        </div>
        {errorAsignar && (
          <div className="mb-2 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{errorAsignar}
          </div>
        )}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  {canEdit && <th className="px-4 py-3 w-8"></th>}
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Póliza No.</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {polizas.map(p => (
                  <>
                    <tr key={p.id} className={`hover:bg-gray-50 ${seleccionPolizas.has(p.id) ? "bg-brand-50" : ""}`}>
                      {canEdit && (
                        <td className="px-4 py-3">
                          {p.estado === "Generada" && (
                            <input type="checkbox" checked={seleccionPolizas.has(p.id)} onChange={() => togglePoliza(p.id)} className="w-4 h-4 accent-brand-600" />
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <button onClick={() => toggleExpandir(p.id)} className="text-gray-400 hover:text-gray-700">
                          {expandido === p.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{p.numero}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.fecha}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.estado === "Liquidada" ? "bg-green-100 text-green-700"
                            : p.estado === "Enviada a Liquidar" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {p.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">{Q(p.total)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link href={`/pasajes/poliza/${p.numero}`}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors ml-auto w-fit">
                          <Printer className="w-3 h-3" /> Imprimir
                        </Link>
                      </td>
                    </tr>
                    {expandido === p.id && (
                      <tr>
                        <td colSpan={canEdit ? 7 : 6} className="px-4 py-3 bg-gray-50">
                          {!detalle[p.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500">
                                  <th className="text-left py-1">Formulario</th>
                                  <th className="text-left py-1">Afiliado</th>
                                  <th className="text-left py-1">Calidad</th>
                                  <th className="text-left py-1">Destino</th>
                                  <th className="text-right py-1">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detalle[p.id].map(i => (
                                  <tr key={i.formulario_no} className="border-t border-gray-200">
                                    <td className="py-1.5 font-mono">{String(i.formulario_no).padStart(4, "0")}</td>
                                    <td className="py-1.5">{i.nombre_afiliado}</td>
                                    <td className="py-1.5">{i.calidad ?? "—"}</td>
                                    <td className="py-1.5">{i.destino}</td>
                                    <td className="py-1.5 text-right font-mono">{Q(i.valor_pasaje)}</td>
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
            {polizas.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">Aún no se ha generado ninguna póliza.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
