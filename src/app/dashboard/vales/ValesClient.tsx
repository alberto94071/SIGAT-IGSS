"use client";
import { Receipt, CheckCircle2 } from "lucide-react";

type Vale = {
  id: number; numero: number; fecha: string; monto: number; motivo: string;
  solicitante_nombre: string;
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ValesClient({ vales }: { vales: Vale[] }) {
  if (vales.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-lg mx-auto mt-10">
        <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Sin vales pendientes</h2>
        <p className="text-sm text-gray-500">No hay vales de Caja Chica esperando ligarse a un pago.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Receipt className="w-5 h-5" /> Fondo Rotativo — Vales
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {vales.length} vale(s) generado(s) en Caja Chica, esperando ligarse a un pago en Fondo Rotativo/Pagos.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Vale</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left">Solicitante</th>
                <th className="px-4 py-3 text-left">Motivo</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vales.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                    {String(v.numero).padStart(7, "0")}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{v.fecha}</td>
                  <td className="px-4 py-3 text-gray-700">{v.solicitante_nombre}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate" title={v.motivo}>{v.motivo}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">{Q(v.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
