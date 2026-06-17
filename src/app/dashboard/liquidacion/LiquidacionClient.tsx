"use client";
import { useState } from "react";
import {
  FileCheck, CheckCircle2, AlertTriangle, TrendingDown,
  Wallet, Landmark, Clock, Printer
} from "lucide-react";
import { actualizarEfectivo } from "./actions";

type Pendiente = { id: number; numero_fri: string|null; descripcion: string|null; monto: number|null; numero_cheque: string|null; proveedor: string|null };
type NoFRI     = { id: number; numero_oc: string|null; descripcion: string|null; monto: number|null; numero_cheque: string|null; estatus: string };

interface Props {
  montoInicial:      number;
  saldoBanco:        number;
  efectivo:          number;
  fondosCirculacion: number;
  pendientes:        Pendiente[];
  nofri:             NoFRI[];
  config:            any;
}

export default function LiquidacionClient({
  montoInicial, saldoBanco, efectivo: efectivoInit,
  fondosCirculacion, pendientes, nofri, config,
}: Props) {
  const [efectivo, setEfectivo]     = useState(efectivoInit);
  const [editEfectivo, setEditEfec] = useState(false);
  const [efVal, setEfVal]           = useState(String(efectivoInit));
  const [saving, setSaving]         = useState(false);

  const conciliacion = saldoBanco + efectivo + fondosCirculacion;
  const diferencia   = conciliacion - montoInicial;
  const cuadrado     = Math.abs(diferencia) < 0.01;

  const fmtQ = (n: number) =>
    n.toLocaleString("es-GT", { style:"currency", currency:"GTQ" });

  async function saveEfectivo() {
    setSaving(true);
    await actualizarEfectivo(parseFloat(efVal));
    setEfectivo(parseFloat(efVal));
    setSaving(false);
    setEditEfec(false);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileCheck className="w-5 h-5" /> Liquidación y Conciliación del Fondo
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {config?.nombre_unidad}
          </p>
        </div>
        <a href="/imprimir/liquidacion" target="_blank"
          className="btn-secondary no-print">
          <Printer className="w-4 h-4" /> Imprimir liquidación
        </a>
      </div>

      {/* ── Conciliación principal ─────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-800">Conciliación del Fondo Rotativo</h2>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${cuadrado ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {cuadrado
              ? <><CheckCircle2 className="w-4 h-4" /> Cuadrado</>
              : <><AlertTriangle className="w-4 h-4" /> Diferencia detectada</>}
          </span>
        </div>

        <div className="space-y-3">
          {/* Banco */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Landmark className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800">Saldo en banco</p>
                <p className="text-xs text-gray-400">Último movimiento registrado</p>
              </div>
            </div>
            <p className="text-lg font-bold text-gray-900">{fmtQ(saldoBanco)}</p>
          </div>

          {/* Efectivo */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                <Wallet className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800">Efectivo en caja</p>
                <p className="text-xs text-gray-400">Dinero físico disponible</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editEfectivo ? (
                <>
                  <input type="number" step="0.01"
                    className="input w-32 text-right text-sm"
                    value={efVal} onChange={e => setEfVal(e.target.value)} />
                  <button onClick={saveEfectivo} disabled={saving}
                    className="btn-primary text-xs py-1.5">
                    {saving ? "…" : "Guardar"}
                  </button>
                  <button onClick={() => setEditEfec(false)} className="btn-secondary text-xs py-1.5">
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-gray-900">{fmtQ(efectivo)}</p>
                  <button onClick={() => setEditEfec(true)}
                    className="text-xs text-gray-400 hover:text-blue-600 underline">
                    editar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Fondos en circulación */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800">Fondos en circulación</p>
                <p className="text-xs text-gray-400">Pagos pendientes de liquidar ({pendientes.length} items)</p>
              </div>
            </div>
            <p className="text-lg font-bold text-gray-900">{fmtQ(fondosCirculacion)}</p>
          </div>

          {/* Totales */}
          <div className="flex items-center justify-between py-3 bg-gray-50 rounded-xl px-4 -mx-1">
            <p className="font-semibold text-gray-700">Conciliación total</p>
            <p className="text-xl font-bold text-gray-900">{fmtQ(conciliacion)}</p>
          </div>
          <div className="flex items-center justify-between py-2 px-4 -mx-1">
            <p className="text-sm text-gray-500">Monto inicial del fondo</p>
            <p className="text-sm font-semibold text-gray-700">{fmtQ(montoInicial)}</p>
          </div>
          <div className={`flex items-center justify-between py-3 rounded-xl px-4 -mx-1 ${cuadrado ? "bg-green-50" : "bg-red-50"}`}>
            <p className={`font-bold ${cuadrado ? "text-green-700" : "text-red-700"}`}>
              Diferencia (debe ser Q 0.00)
            </p>
            <p className={`text-xl font-bold ${cuadrado ? "text-green-700" : "text-red-700"}`}>
              {fmtQ(diferencia)}
            </p>
          </div>
        </div>

        {/* Resolución */}
        <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400 space-y-0.5">
          <p>Institución: {config?.nombre_unidad}</p>
          <p>{config?.resolucion_fondo} · Ejercicio {config?.ejercicio_fiscal}</p>
        </div>
      </div>

      {/* ── Fondos en circulación (detalle) ───────────────────────── */}
      {pendientes.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              Fondos pendientes de liquidar
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2.5 text-left">FRI</th>
                <th className="px-4 py-2.5 text-left">Descripción</th>
                <th className="px-4 py-2.5 text-left">Proveedor</th>
                <th className="px-4 py-2.5 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pendientes.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{p.numero_fri ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate">{p.descripcion}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 truncate">{p.proveedor}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums text-gray-900">
                    {fmtQ(p.monto ?? 0)}
                  </td>
                </tr>
              ))}
              <tr className="bg-yellow-50 font-semibold">
                <td colSpan={3} className="px-4 py-2.5 text-yellow-700">Total en circulación</td>
                <td className="px-4 py-2.5 text-right text-yellow-800 tabular-nums">
                  {fmtQ(fondosCirculacion)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── Docs pagados sin FRI ────────────────────────────────────── */}
      {nofri.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h2 className="font-semibold text-gray-700 text-sm">
              Documentos pagados sin N° FRI asignado
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2.5 text-left">OC</th>
                <th className="px-4 py-2.5 text-left">Descripción</th>
                <th className="px-4 py-2.5 text-left">Cheque</th>
                <th className="px-4 py-2.5 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {nofri.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{p.numero_oc ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate">{p.descripcion}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{p.numero_cheque ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums text-gray-900">
                    {fmtQ(p.monto ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
