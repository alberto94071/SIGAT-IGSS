"use client";
import Link from "next/link";
import { FileText, Printer } from "lucide-react";

type Solicitud = {
  id: number; numero_formulario: string | null; persona_nombre: string | null; estado: string;
  aprobado_en: string | null; rechazado_en: string | null; motivo_rechazo: string | null;
};

const ESTADO_STYLE: Record<string, string> = {
  "Aprobado":  "bg-green-100 text-green-700",
  "Rechazado": "bg-red-100 text-red-700",
};

export default function EntregaFormularioClient({ solicitudes }: { solicitudes: Solicitud[] }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5" /> Entrega de Formulario
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Archivo de viáticos ya resueltos — reimprimí V-A/V-C/V-L de los aprobados.</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Formulario</th>
                <th className="px-4 py-3 text-left">Colaborador</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {solicitudes.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{s.numero_formulario ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{s.persona_nombre ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_STYLE[s.estado] ?? "bg-gray-100 text-gray-600"}`}>
                      {s.estado}
                    </span>
                    {s.estado === "Rechazado" && s.motivo_rechazo && (
                      <p className="text-xs text-gray-400 mt-0.5 max-w-xs">{s.motivo_rechazo}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {s.estado === "Aprobado" ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/viaticos/entrega-formulario/${s.id}/imprimir/va`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                          <Printer className="w-3 h-3" /> V-A
                        </Link>
                        <Link href={`/viaticos/entrega-formulario/${s.id}/imprimir/vc`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                          <Printer className="w-3 h-3" /> V-C
                        </Link>
                        <Link href={`/viaticos/entrega-formulario/${s.id}/imprimir/vl`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                          <Printer className="w-3 h-3" /> V-L
                        </Link>
                      </div>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {solicitudes.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nada por acá todavía.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
