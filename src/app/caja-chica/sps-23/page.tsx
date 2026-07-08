import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Printer } from "lucide-react";
import { listarPagosPasajes } from "@/lib/pasajes-actions";

export default async function Dpd23ListaPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const pagos = await listarPagosPasajes();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5" /> DPD-23 — Recibo de Gastos de Transporte
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Selecciona un pago para imprimir su recibo individual.</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Formulario</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Afiliación</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagos.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{String(p.formulario_no).padStart(4, "0")}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.fecha_pago}</td>
                  <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{p.afiliacion}</td>
                  <td className="px-4 py-3 text-gray-700">{p.nombre_afiliado}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/caja-chica/sps-23/${p.formulario_no}`}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors ml-auto w-fit">
                      <Printer className="w-3 h-3" /> Imprimir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagos.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aún no se ha registrado ningún pago de pasaje.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
