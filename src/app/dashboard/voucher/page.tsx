import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Receipt as ReceiptIcon, Printer } from "lucide-react";
import { getVouchers } from "@/lib/vale-actions";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const TIPO_LABEL: Record<string, string> = { pasajes: "Pago de Pasajes", gastos_varios: "Gastos Varios" };

export default async function VoucherPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const vouchers = await getVouchers();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ReceiptIcon className="w-5 h-5" /> Voucher
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Cheques generados a partir de vales de Caja Chica.</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Cheque No.</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha Emisión</th>
                <th className="px-4 py-3 text-left">A nombre de</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Tipo</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Monto</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vouchers.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{v.numero_cheque}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{v.fecha_emision}</td>
                  <td className="px-4 py-3 text-gray-700">{v.destinatario_cheque}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{TIPO_LABEL[v.tipo] ?? v.tipo}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">{Q(v.monto_autorizado ?? v.monto)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/dashboard/voucher/${v.id}/imprimir`}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors ml-auto w-fit">
                      <Printer className="w-3 h-3" /> Imprimir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vouchers.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <ReceiptIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aún no se ha generado ningún voucher.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
