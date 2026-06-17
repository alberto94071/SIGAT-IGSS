"use client";
import { useState, useMemo } from "react";
import { BarChart3, Printer } from "lucide-react";

type Mov = { id: number; mes: string|null; numero_documento: string|null; tipo_documento: string|null; status: string|null; fecha_movimiento: string; nit_beneficiario: string|null; beneficiario: string|null; descripcion: string|null; egresos: number|null; ingresos: number|null; saldo: number|null };
type Pago = { id: number; siaf_numero: number|null; descripcion: string|null; monto: number|null; estatus: string; cuatrimestre: string|null; numero_cheque: string|null; proveedor: string|null; fecha_pagado: string|null; renglon: number|null };
type Gasto = { id: number; numero_cheque: string|null; numero_vale: number|null; tipo_documento: string|null; numero_documento: string|null; nombre_beneficiario: string|null; costo: number|null; tipo_servicio: string|null; fecha: string|null; fecha_pago: string|null };

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const TABS  = ["Libro de banco","Conciliación bancaria","Libro caja chica","Programación"];

interface Props { banco: Mov[]; pagos: Pago[]; cajaChica: Gasto[] }

export default function ReportesClient({ banco, pagos, cajaChica }: Props) {
  const [tab,     setTab]     = useState(0);
  const [mes,     setMes]     = useState(MESES[new Date().getMonth()]);

  const fmtQ = (n: string|null|number) => {
    const v = typeof n === "number" ? n : parseFloat(n ?? "0");
    return v.toLocaleString("es-GT", { style: "currency", currency: "GTQ" });
  };

  // ── Libro de banco ────────────────────────────────────────────
  const bancoMes = useMemo(() => banco.filter(m => m.mes === mes), [banco, mes]);
  const totalEgMes = useMemo(() => bancoMes.reduce((a, m) => a + (m.egresos ?? 0), 0), [bancoMes]);
  const totalIngMes = useMemo(() => bancoMes.reduce((a, m) => a + (m.ingresos ?? 0), 0), [bancoMes]);
  const saldoFinalMes = bancoMes.length ? (bancoMes[bancoMes.length - 1].saldo ?? 0) : 0;

  // ── Conciliación bancaria ─────────────────────────────────────
  const chequesCircMes = useMemo(() =>
    banco.filter(m => m.mes === mes && m.tipo_documento === "Cheque" && m.status !== "Operado"),
    [banco, mes]);
  const totalChequesCirc = chequesCircMes.reduce((a, m) => a + (m.egresos ?? 0), 0);

  // ── Libro caja chica ──────────────────────────────────────────
  const gastosChequeMes = useMemo(() => {
    const chequesMes = new Set(
      banco.filter(m => m.mes === mes).map(m => m.numero_documento)
    );
    return cajaChica.filter(g => g.numero_cheque && chequesMes.has(g.numero_cheque));
  }, [cajaChica, banco, mes]);
  const totalCaja = gastosChequeMes.reduce((a, g) => a + (g.costo ?? 0), 0);

  // ── Programación (resumen mensual por estatus) ─────────────────
  const resumenMeses = useMemo(() =>
    MESES.map(m => {
      const movs = banco.filter(bk => bk.mes === m);
      const egr  = movs.reduce((a, mv) => a + (mv.egresos  ?? 0), 0);
      const ing  = movs.reduce((a, mv) => a + (mv.ingresos ?? 0), 0);
      const pend = pagos.filter(p => p.estatus === "Pendiente").length;
      return { mes: m, egresos: egr, ingresos: ing, pendientes: pend };
    }),
    [banco, pagos]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" /> Reportes
        </h1>
        <button onClick={() => window.print()}
          className="btn-secondary no-print">
          <Printer className="w-4 h-4" /> Imprimir reporte
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === i
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Selector de mes (para los 3 primeros tabs) */}
      {tab < 3 && (
        <div className="flex gap-1 flex-wrap">
          {MESES.map(m => (
            <button key={m} onClick={() => setMes(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mes === m ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {m}
            </button>
          ))}
        </div>
      )}

      {/* ── TAB 0: Libro de banco ───────────────────────────────── */}
      {tab === 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-sm text-gray-700">
              Libro de banco — {mes} 2026
            </h2>
            <span className="text-xs text-gray-400">{bancoMes.length} movimientos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-2.5 text-left">Fecha</th>
                  <th className="px-4 py-2.5 text-left">Tipo / N° Doc</th>
                  <th className="px-4 py-2.5 text-left">Beneficiario</th>
                  <th className="px-4 py-2.5 text-left">Descripción</th>
                  <th className="px-4 py-2.5 text-right">Egresos</th>
                  <th className="px-4 py-2.5 text-right">Ingresos</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bancoMes.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{m.fecha_movimiento}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-medium text-gray-700">{m.tipo_documento}</span>
                      <p className="font-mono text-xs text-gray-400">{m.numero_documento}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[140px] truncate">{m.beneficiario}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[180px] truncate">{m.descripcion}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-700 text-xs">
                      {(m.egresos ?? 0) > 0 ? fmtQ(m.egresos) : ""}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-green-700 text-xs">
                      {(m.ingresos ?? 0) > 0 ? fmtQ(m.ingresos) : ""}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold text-gray-900 text-xs">
                      {fmtQ(m.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-sm">
                  <td colSpan={4} className="px-4 py-3 text-gray-600">Total {mes}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-700">{fmtQ(totalEgMes)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700">{fmtQ(totalIngMes)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">{fmtQ(saldoFinalMes)}</td>
                </tr>
              </tfoot>
            </table>
            {bancoMes.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">Sin movimientos en {mes}</div>}
          </div>
        </div>
      )}

      {/* ── TAB 1: Conciliación bancaria ────────────────────────── */}
      {tab === 1 && (
        <div className="space-y-4">
          <div className="card p-5 max-w-md">
            <h2 className="font-semibold text-sm text-gray-700 mb-4">Conciliación del estado de cuenta — {mes}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Saldo según banco</span>
                <span className="font-semibold">{fmtQ(saldoFinalMes)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Cheques en circulación</span>
                <span className="font-semibold text-red-600">({fmtQ(totalChequesCirc)})</span>
              </div>
              <div className="flex justify-between py-2 bg-gray-50 rounded-lg px-3 font-bold">
                <span>Saldo conciliado</span>
                <span>{fmtQ(saldoFinalMes - totalChequesCirc)}</span>
              </div>
            </div>
          </div>

          {chequesCircMes.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Cheques en circulación — {mes}</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-2.5 text-left">N° Cheque</th>
                    <th className="px-4 py-2.5 text-left">Beneficiario</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                    <th className="px-4 py-2.5 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {chequesCircMes.map(m => (
                    <tr key={m.id}>
                      <td className="px-4 py-2.5 font-mono text-xs">{m.numero_documento}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{m.beneficiario}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{m.status}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs font-medium">{fmtQ(m.egresos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Libro caja chica ──────────────────────────────── */}
      {tab === 2 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex justify-between">
            <h2 className="font-semibold text-sm text-gray-700">Libro de caja chica — {mes}</h2>
            <span className="text-xs text-gray-400">Total: <strong>{fmtQ(totalCaja)}</strong></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-2.5 text-left">Cheque/Vale</th>
                  <th className="px-4 py-2.5 text-left">Tipo</th>
                  <th className="px-4 py-2.5 text-left">Fecha</th>
                  <th className="px-4 py-2.5 text-left">Beneficiario</th>
                  <th className="px-4 py-2.5 text-left">Servicio</th>
                  <th className="px-4 py-2.5 text-right">Costo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {gastosChequeMes.map(g => (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">Ch.{g.numero_cheque} V.{g.numero_vale}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{g.tipo_documento}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{g.fecha}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-700 max-w-[140px] truncate">{g.nombre_beneficiario}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[180px] truncate">{g.tipo_servicio}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs font-medium">{fmtQ(g.costo)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 font-semibold text-sm">
                  <td colSpan={5} className="px-4 py-3 text-gray-600">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtQ(totalCaja)}</td>
                </tr>
              </tfoot>
            </table>
            {gastosChequeMes.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">Sin gastos de caja chica en {mes}</div>}
          </div>
        </div>
      )}

      {/* ── TAB 3: Programación anual ────────────────────────────── */}
      {tab === 3 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-sm text-gray-700">Ejecución presupuestaria 2026</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Mes</th>
                  <th className="px-4 py-3 text-right">Egresos</th>
                  <th className="px-4 py-3 text-right">Ingresos/Reintegros</th>
                  <th className="px-4 py-3 text-right">Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {resumenMeses.map(r => (
                  <tr key={r.mes}
                    className={`hover:bg-gray-50 transition-colors ${r.mes === mes ? "bg-brand-50" : ""}`}>
                    <td className="px-4 py-3 font-medium text-gray-700">
                      {r.mes}
                      {r.mes === mes && <span className="ml-2 text-xs text-brand-600">(mes actual)</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-700">
                      {r.egresos > 0 ? fmtQ(r.egresos) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700">
                      {r.ingresos > 0 ? fmtQ(r.ingresos) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${r.ingresos - r.egresos >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {(r.egresos === 0 && r.ingresos === 0)
                        ? <span className="text-gray-300">—</span>
                        : fmtQ(r.ingresos - r.egresos)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 font-bold text-sm">
                  <td className="px-4 py-3 text-gray-700">Total anual</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-700">
                    {fmtQ(resumenMeses.reduce((a, r) => a + r.egresos, 0))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700">
                    {fmtQ(resumenMeses.reduce((a, r) => a + r.ingresos, 0))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                    {fmtQ(resumenMeses.reduce((a, r) => a + (r.ingresos - r.egresos), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
