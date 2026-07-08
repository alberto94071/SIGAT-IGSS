import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileCheck, Printer } from "lucide-react";
import { listarNumerosPoliza } from "@/lib/pasajes-actions";

export default async function PolizaListaPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const numeros = await listarNumerosPoliza();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileCheck className="w-5 h-5" /> Póliza — Cuadro de Caja
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Agrupa los pagos de pasaje por número de póliza para imprimir el cuadro de caja semanal.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Póliza No.</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {numeros.map(n => (
                <tr key={n} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{n}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/caja-chica/poliza/${n}`}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors ml-auto w-fit">
                      <Printer className="w-3 h-3" /> Ver / Imprimir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {numeros.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aún no hay pagos de pasaje con número de póliza asignado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
