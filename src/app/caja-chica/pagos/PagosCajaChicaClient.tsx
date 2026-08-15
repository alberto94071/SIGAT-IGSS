"use client";
import { useState } from "react";
import { FileCheck, Loader2, CheckCircle2, Wallet } from "lucide-react";
import { liquidarPago } from "@/lib/caja-chica-liquidacion-actions";
import type { PagoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import ExpandableRow from "@/components/ExpandableRow";
import TrazabilidadPanel from "@/components/TrazabilidadPanel";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props { pagos: PagoFondoRotativo[]; }

export default function PagosCajaChicaClient({ pagos: init }: Props) {
  const [pagos, setPagos] = useState(init);
  const [liquidando, setLiquidando] = useState<number | null>(null);
  const [error, setError] = useState<Record<number, string>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function handleLiquidar(id: number) {
    setLiquidando(id); setError(prev => ({ ...prev, [id]: "" }));
    const res = await liquidarPago(id);
    setLiquidando(null);
    if ("error" in res) { setError(prev => ({ ...prev, [id]: res.error })); return; }
    setPagos(p => p.filter(x => x.id !== id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="w-5 h-5" /> Pagos
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Pagos en efectivo que llegaron de Fondo Rotativo/Pagos, pendientes de liquidar contra su vale.</p>
      </div>

      {pagos.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No hay pagos en efectivo esperando liquidarse.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 w-8"></th>
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
                  <ExpandableRow key={p.id} colSpan={8}
                    expanded={expandedId === p.id}
                    onToggle={() => setExpandedId(prev => prev === p.id ? null : p.id)}
                    rowClassName="hover:bg-gray-50 cursor-pointer transition-colors"
                    detail={<TrazabilidadPanel
                      titulo={`Detalle del Vale ${p.numero_vale ?? ""}`}
                      cadena={[{ label: "FRI", value: p.fri_numero != null ? `${p.fri_numero}/${p.fri_anio}` : null }]}
                      traz={p.traz}
                    />}>
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
                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-col items-end gap-1">
                        <button onClick={() => handleLiquidar(p.id)} disabled={liquidando === p.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors ml-auto">
                          {liquidando === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileCheck className="w-3 h-3" />} Liquidar
                        </button>
                        {error[p.id] && <p className="text-[10px] text-red-600">{error[p.id]}</p>}
                      </div>
                    </td>
                  </ExpandableRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
