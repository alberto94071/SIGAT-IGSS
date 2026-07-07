"use client";
import { useState } from "react";
import { FileCheck, Loader2, CheckCircle2 } from "lucide-react";
import { liquidarPago } from "@/lib/caja-chica-liquidacion-actions";
import type { PagoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function LiquidacionClient({ pagos: init }: { pagos: PagoFondoRotativo[] }) {
  const [pagos, setPagos] = useState(init);
  const [liquidando, setLiquidando] = useState<number | null>(null);
  const [error, setError] = useState<Record<number, string>>({});

  async function handleLiquidar(id: number) {
    setLiquidando(id); setError(prev => ({ ...prev, [id]: "" }));
    const res = await liquidarPago(id);
    setLiquidando(null);
    if ("error" in res) { setError(prev => ({ ...prev, [id]: res.error })); return; }
    setPagos(p => p.filter(x => x.id !== id));
  }

  if (pagos.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-lg mx-auto mt-10">
        <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Sin liquidaciones pendientes</h2>
        <p className="text-sm text-gray-500">No hay pagos en efectivo esperando liquidarse contra su vale.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileCheck className="w-5 h-5" /> Liquidación
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {pagos.length} vale(s) pagado(s) en efectivo desde Fondo Rotativo, esperando liquidarse.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Vale</th>
                <th className="px-4 py-3 text-left">Solicitante</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. A-04 SIAF</th>
                <th className="px-4 py-3 text-left">Destinatario</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha de pago</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagos.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{p.numero_vale ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{p.vale_solicitante_nombre ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">
                    {p.numero_a04 != null ? `${p.numero_a04}/${p.anio_a04}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.destinatario_nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.fecha_pago ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                    {p.total != null ? Q(p.total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex flex-col items-end gap-1">
                      <button onClick={() => handleLiquidar(p.id)} disabled={liquidando === p.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors ml-auto">
                        {liquidando === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileCheck className="w-3 h-3" />} Liquidar
                      </button>
                      {error[p.id] && <p className="text-[10px] text-red-600">{error[p.id]}</p>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
