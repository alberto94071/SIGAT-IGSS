import { db } from "@/lib/db";
import { movimientosBanco, cajaChica, configuracion } from "@/lib/schema";
import { eq, sum } from "drizzle-orm";
import { notFound } from "next/navigation";
import PrintButtons from "@/components/PrintButtons";

export default async function ValePrintPage({
  searchParams,
}: { searchParams: Promise<{ cheque?: string; vale?: string }> }) {
  const { cheque, vale } = await searchParams;
  if (!cheque) notFound();

  const [config] = await db.select().from(configuracion).limit(1);

  // Gastos de este vale
  const gastos = await db.select().from(cajaChica)
    .where(eq(cajaChica.numero_cheque, cheque));

  const totalGastos = gastos.reduce((a, g) => a + parseFloat(g.costo ?? "0"), 0);

  // Datos del cheque en banco
  const [movBanco] = await db.select()
    .from(movimientosBanco)
    .where(eq(movimientosBanco.numero_documento, cheque))
    .limit(1);

  const hoy = new Date().toLocaleDateString("es-GT", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <div className="p-8 max-w-3xl mx-auto text-sm font-sans">
      <PrintButtons />

      <div className="border-2 border-gray-700">
        {/* Header */}
        <div className="bg-gray-100 p-4 border-b border-gray-400">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-500">Instituto Guatemalteco de Seguridad Social</p>
              <p className="font-bold text-sm">{config?.nombre_unidad}</p>
              <p className="text-xs text-gray-500">{config?.municipio}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">VALE</p>
              <p className="text-2xl font-bold text-gray-700">N° {vale ?? gastos[0]?.numero_vale ?? "—"}</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-gray-500">Cheque N°</p>
              <p className="font-bold text-lg">{cheque}</p>
            </div>
            <div>
              <p className="text-gray-500">Beneficiario</p>
              <p className="font-semibold">{movBanco?.beneficiario ?? gastos[0]?.nombre_beneficiario ?? "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Fecha</p>
              <p className="font-semibold">{movBanco?.fecha_movimiento ?? hoy}</p>
            </div>
          </div>

          <div>
            <p className="text-gray-500 mb-1">Descripción / Motivo</p>
            <p className="border border-gray-300 p-2 min-h-[40px]">
              {movBanco?.descripcion ?? "Caja Chica — gastos varios"}
            </p>
          </div>

          {/* Detalle de gastos */}
          <table className="w-full border border-gray-300 mt-2">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-1.5 text-left">Tipo</th>
                <th className="border border-gray-300 px-2 py-1.5 text-left">N° Documento / Serie</th>
                <th className="border border-gray-300 px-2 py-1.5 text-left">Beneficiario</th>
                <th className="border border-gray-300 px-2 py-1.5 text-left">Servicio</th>
                <th className="border border-gray-300 px-2 py-1.5 text-right">Costo</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map(g => (
                <tr key={g.id}>
                  <td className="border border-gray-300 px-2 py-1.5">{g.tipo_documento}</td>
                  <td className="border border-gray-300 px-2 py-1.5 font-mono">{g.numero_documento} / {g.numero_serie}</td>
                  <td className="border border-gray-300 px-2 py-1.5">{g.nombre_beneficiario}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-gray-600 max-w-[180px]">{g.tipo_servicio}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums font-medium">
                    Q {parseFloat(g.costo ?? "0").toLocaleString("es-GT", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-50">
                <td colSpan={4} className="border border-gray-300 px-2 py-2 text-right">Total</td>
                <td className="border border-gray-300 px-2 py-2 text-right tabular-nums">
                  Q {totalGastos.toLocaleString("es-GT", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Saldo a devolver */}
          <div className="flex justify-end">
            <div className="border border-gray-400 p-3 text-right min-w-[220px]">
              <p className="text-gray-500">Monto del vale</p>
              <p className="font-bold">Q {parseFloat(movBanco?.egresos ?? "0").toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>
              <p className="text-gray-500 mt-1">Total gastado</p>
              <p className="font-bold">Q {totalGastos.toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>
              <div className="border-t border-gray-400 mt-2 pt-2">
                <p className="text-gray-500">Saldo a devolver</p>
                <p className={`text-lg font-bold ${(parseFloat(movBanco?.egresos ?? "0") - totalGastos) >= 0 ? "text-green-700" : "text-red-700"}`}>
                  Q {(parseFloat(movBanco?.egresos ?? "0") - totalGastos).toLocaleString("es-GT", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Firmas */}
          <div className="grid grid-cols-2 gap-10 mt-8 text-center">
            <div>
              <div className="border-t border-gray-600 pt-2 mt-8">
                <p className="font-semibold">{gastos[0]?.nombre_beneficiario ?? "Solicitante"}</p>
                <p className="text-gray-500">Firma y Sello del Solicitante</p>
              </div>
            </div>
            <div>
              <div className="border-t border-gray-600 pt-2 mt-8">
                <p className="font-semibold">{config?.nombre_responsable}</p>
                <p className="text-gray-500">Responsable del FRI · Empleado {config?.numero_empleado_resp}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
