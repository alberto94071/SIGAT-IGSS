"use client";
import { useState, useMemo } from "react";
import { ShoppingCart, Search } from "lucide-react";

type Orden = {
  id: number; numero: number; anio: number; fecha: string;
  consolidacion_id: number; tipo_compra: string;
  nog: string | null; referencia: string | null;
  proveedor_nit: string | null; proveedor_nombre: string | null;
  costo_unitario: number | null; total_cantidad: number | null;
  exento_iva: boolean; total: number | null;
  estado: string; created_at: string | null;
};

const TIPO_COLOR: Record<string, string> = {
  "Compra Directa":    "bg-blue-100 text-blue-700",
  "Baja Cuantía":      "bg-emerald-100 text-emerald-700",
  "Contrato Abierto":  "bg-amber-100 text-amber-700",
  "Casos de Excepción": "bg-orange-100 text-orange-700",
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OrdenesClient({ ordenes: init }: { ordenes: Orden[] }) {
  const [ordenes] = useState(init);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return ordenes;
    return ordenes.filter(o =>
      `OC-${String(o.numero).padStart(3, "0")}/${o.anio}`.includes(q) ||
      o.tipo_compra.toLowerCase().includes(q) ||
      (o.proveedor_nombre ?? "").toLowerCase().includes(q) ||
      (o.proveedor_nit ?? "").includes(q) ||
      (o.nog ?? "").includes(q) ||
      (o.referencia ?? "").toLowerCase().includes(q)
    );
  }, [ordenes, query]);

  const totalGeneral = useMemo(() =>
    ordenes.reduce((sum, o) => sum + (o.total ?? 0), 0),
    [ordenes]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Órdenes de Compra
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {ordenes.length} orden(es) generada(s) · Total acumulado: <strong className="text-green-700">{Q(totalGeneral)}</strong>
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por correlativo, proveedor, NOG…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Correlativo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Tipo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Referencia / NOG</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">IVA</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                    OC-{String(o.numero).padStart(3, "0")}/{o.anio}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLOR[o.tipo_compra] ?? "bg-gray-100 text-gray-600"}`}>
                      {o.tipo_compra}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{o.fecha}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{o.proveedor_nombre ?? "—"}</p>
                    {o.proveedor_nit && <p className="text-xs text-gray-400">NIT: {o.proveedor_nit}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {o.nog ? <span className="font-mono">NOG: {o.nog}</span> : (o.referencia ?? "—")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                    {o.total != null ? Q(o.total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${o.exento_iva ? "bg-gray-100 text-gray-600" : "bg-orange-100 text-orange-700"}`}>
                      {o.exento_iva ? "Exento" : "Con IVA"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      {o.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay órdenes de compra generadas aún.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
