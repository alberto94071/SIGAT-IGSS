"use client";
import { useState } from "react";
import { FileCheck, Loader2 } from "lucide-react";
import { devengar } from "@/lib/adjudicacion/devengado-actions";
import RenglonBadges from "@/components/RenglonBadges";

type Orden = {
  id: number; numero: number; anio: number; tipo_compra: string;
  proveedor_nit: string | null; proveedor_nombre: string | null;
  total: number | null; codigo_ppr: string | null; no_compromiso: string | null;
  renglones: { renglon: number | null; subproducto: string; nombre: string; cantidad: number }[];
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DevengadoClient({ ordenes: init }: { ordenes: Orden[] }) {
  const [ordenes, setOrdenes] = useState(init);
  const [procesando, setProcesando] = useState<number | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});

  async function handleDevengar(o: Orden) {
    setProcesando(o.id); setRowError(p => ({ ...p, [o.id]: "" }));
    const res = await devengar(o.id);
    setProcesando(null);
    if ("error" in res) { setRowError(p => ({ ...p, [o.id]: res.error })); return; }
    setOrdenes(p => p.filter(x => x.id !== o.id));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileCheck className="w-5 h-5" /> Presupuesto — Devengado
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{ordenes.length} orden(es) pendiente(s) de devengar</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Orden</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Compromiso</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ordenes.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                    OC-{String(o.numero).padStart(3, "0")}/{o.anio}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{o.no_compromiso ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{o.proveedor_nombre ?? "—"}</p>
                    {o.proveedor_nit && <p className="text-xs text-gray-400">NIT: {o.proveedor_nit}</p>}
                    <RenglonBadges renglones={o.renglones} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                    {o.total != null ? Q(o.total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex flex-col items-end gap-1">
                      <button onClick={() => handleDevengar(o)} disabled={procesando === o.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors ml-auto">
                        {procesando === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileCheck className="w-3 h-3" />} Devengar
                      </button>
                      {rowError[o.id] && <p className="text-[10px] text-red-600 max-w-[160px] text-right">{rowError[o.id]}</p>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ordenes.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay órdenes pendientes de devengar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
