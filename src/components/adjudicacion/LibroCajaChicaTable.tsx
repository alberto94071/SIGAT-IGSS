import { Coins, CheckCircle2 } from "lucide-react";
import type { LibroCajaChicaRow } from "@/lib/caja-chica-liquidacion-actions";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ORIGEN_COLOR: Record<LibroCajaChicaRow["origen"], string> = {
  Factura: "bg-blue-100 text-blue-700",
  Vale: "bg-purple-100 text-purple-700",
};

export default function LibroCajaChicaTable({ filas }: { filas: LibroCajaChicaRow[] }) {
  if (filas.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-lg mx-auto mt-10">
        <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Sin registros</h2>
        <p className="text-sm text-gray-500">No hay vales liquidados todavía.</p>
      </div>
    );
  }

  const total = filas.reduce((s, f) => s + (f.total ?? 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Coins className="w-5 h-5" /> Libro Caja Chica
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{filas.length} registro(s) · Total {Q(total)}</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Origen</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. A-04 SIAF</th>
                <th className="px-4 py-3 text-left">Destinatario</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Factura / Detalle</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Vale</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha de pago</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filas.map(f => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${ORIGEN_COLOR[f.origen]}`}>
                      {f.origen}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                    {f.numero_a04 != null ? `${f.numero_a04}/${f.anio_a04}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{f.destinatario_nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{f.factura ?? f.detalle ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{f.numero_vale ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.fecha_pago ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                    {f.total != null ? Q(f.total) : "—"}
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
