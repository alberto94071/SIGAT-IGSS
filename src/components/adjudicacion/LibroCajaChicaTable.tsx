"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Coins, Search, Printer, Download } from "lucide-react";
import type { MovimientoCajaChica } from "@/lib/caja-chica-liquidacion-actions";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TIPO_COLOR: Record<string, string> = {
  Cheque: "bg-green-100 text-green-700",
  Factura: "bg-red-100 text-red-700",
  Formulario: "bg-blue-100 text-blue-700",
  Vale: "bg-purple-100 text-purple-700",
};

export default function LibroCajaChicaTable({ movimientos }: { movimientos: MovimientoCajaChica[] }) {
  const [query, setQuery] = useState("");
  const [mes, setMes] = useState("");

  const meses = useMemo(() => {
    const set = new Set(movimientos.filter(m => m.fecha).map(m => m.fecha.slice(0, 7)));
    return [...set].sort().reverse();
  }, [movimientos]);

  const q = query.toLowerCase().trim();
  const filtrados = useMemo(() => !q ? movimientos : movimientos.filter(m =>
    m.descripcion.toLowerCase().includes(q) ||
    m.beneficiario.toLowerCase().includes(q) ||
    m.numeroDocumento.toLowerCase().includes(q) ||
    m.fecha.includes(q)
  ), [movimientos, q]);

  const saldoActual = movimientos.length > 0 ? movimientos[movimientos.length - 1].saldo : null;

  if (movimientos.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-lg mx-auto mt-10">
        <Coins className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Sin registros</h2>
        <p className="text-sm text-gray-500">Todavía no hay movimientos de Caja Chica.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Coins className="w-5 h-5" /> Libro Caja Chica
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Registro de créditos (constitución de Caja Chica) y débitos (gastos pagados), en orden cronológico
          {saldoActual != null && <> · Saldo actual: <span className="font-mono font-semibold text-gray-700">{Q(saldoActual)}</span></>}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar por beneficiario, documento, descripción, fecha…"
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <select className="input w-auto" value={mes} onChange={e => setMes(e.target.value)}>
          <option value="">Elegir mes para imprimir/exportar…</option>
          {meses.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {mes && (
          <>
            <Link href={`/caja-chica/libro-caja-chica/imprimir/${mes}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors">
              <Printer className="w-3.5 h-3.5" /> Imprimir reporte del mes
            </Link>
            <a href={`/api/caja-chica/reporte?mes=${mes}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
              <Download className="w-3.5 h-3.5" /> Exportar Excel
            </a>
          </>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Tipo de Documento</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Documento</th>
                <th className="px-4 py-3 text-left">Beneficiario</th>
                <th className="px-4 py-3 text-left">Descripción del Desembolso</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Crédito</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Débito</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{m.fecha || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TIPO_COLOR[m.tipoDocumento] ?? "bg-gray-100 text-gray-700"}`}>
                      {m.tipoDocumento}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{m.numeroDocumento}</td>
                  <td className="px-4 py-3 text-gray-900">{m.beneficiario}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{m.descripcion}</td>
                  <td className="px-4 py-3 text-right font-mono text-green-700 whitespace-nowrap">{m.credito > 0 ? Q(m.credito) : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-700 whitespace-nowrap">{m.debito > 0 ? Q(m.debito) : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap">{Q(m.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Coins className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin resultados para esa búsqueda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
