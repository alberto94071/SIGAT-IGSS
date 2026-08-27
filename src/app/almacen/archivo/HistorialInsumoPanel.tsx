"use client";
import { useState } from "react";
import { FileSpreadsheet, Download } from "lucide-react";

type InsumoParaHistorial = { id: number; codigo_igss: string | null; nombre: string };

export default function HistorialInsumoPanel({ insumos }: { insumos: InsumoParaHistorial[] }) {
  const [insumoId, setInsumoId] = useState<number | "">(insumos[0]?.id ?? "");

  if (insumos.length === 0) return null;

  return (
    <div className="card p-4 flex items-center gap-3 flex-wrap">
      <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
      <div className="flex-1 min-w-[200px]">
        <label className="text-xs font-semibold text-gray-600">Descargar historial de un insumo</label>
        <select className="input mt-1" value={insumoId} onChange={e => setInsumoId(Number(e.target.value))}>
          {insumos.map(i => (
            <option key={i.id} value={i.id}>{i.nombre} ({i.codigo_igss ?? "S/C"})</option>
          ))}
        </select>
      </div>
      <a href={insumoId !== "" ? `/api/almacen/dab75-historial?insumoId=${insumoId}` : undefined}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors self-end">
        <Download className="w-4 h-4" /> Descargar Excel
      </a>
    </div>
  );
}
