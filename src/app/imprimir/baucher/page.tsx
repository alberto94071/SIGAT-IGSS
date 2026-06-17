import { db } from "@/lib/db";
import { movimientosBanco, pagos, configuracion } from "@/lib/schema";
import { eq, sum } from "drizzle-orm";
import { notFound } from "next/navigation";
import PrintButtons from "@/components/PrintButtons";

export default async function BaucherPrintPage({
  searchParams,
}: { searchParams: Promise<{ cheque?: string }> }) {
  const { cheque } = await searchParams;
  if (!cheque) notFound();

  const [config] = await db.select().from(configuracion).limit(1);

  const [movBanco] = await db.select()
    .from(movimientosBanco)
    .where(eq(movimientosBanco.numero_documento, cheque))
    .limit(1);

  const pagosCheque = await db.select().from(pagos)
    .where(eq(pagos.numero_cheque, cheque));

  const total = pagosCheque.reduce((a, p) => a + parseFloat(p.monto ?? "0"), 0);

  const hoy = new Date().toLocaleDateString("es-GT", {
    day: "2-digit", month: "long", year: "numeric",
  });

  // Texto del baucher
  const descripcionBaucher = pagosCheque.length > 0
    ? `Páguese a ${movBanco?.beneficiario ?? pagosCheque[0].proveedor} por ${pagosCheque.map(p => p.descripcion).join("; ")}, según documentos adjuntos.`
    : movBanco?.descripcion ?? "";

  return (
    <div className="p-8 max-w-2xl mx-auto text-sm font-sans">
      <PrintButtons />

      {/* Original */}
      <div className="border-2 border-gray-700 p-5 mb-6">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-xs font-bold uppercase">NO NEGOCIABLE</p>
            <p className="text-xs text-gray-500 mt-1">{config?.nombre_unidad}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Baucher N°</p>
            <p className="text-xl font-bold">{cheque}</p>
          </div>
        </div>

        <div className="border border-gray-300 p-3 my-3 text-xs space-y-1.5">
          <p><strong>Beneficiario:</strong> {movBanco?.beneficiario ?? pagosCheque[0]?.proveedor ?? "—"}</p>
          <p><strong>NIT:</strong> {movBanco?.nit_beneficiario ?? pagosCheque[0]?.nit_proveedor ?? "—"}</p>
          <p><strong>Fecha:</strong> {movBanco?.fecha_movimiento ?? hoy}</p>
          <p><strong>Descripción:</strong> {descripcionBaucher}</p>
        </div>

        {pagosCheque.length > 0 && (
          <table className="w-full border border-gray-300 text-xs mb-3">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-1 text-left">Descripción</th>
                <th className="border border-gray-300 px-2 py-1 text-left">N° Doc</th>
                <th className="border border-gray-300 px-2 py-1 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {pagosCheque.map(p => (
                <tr key={p.id}>
                  <td className="border border-gray-300 px-2 py-1">{p.descripcion}</td>
                  <td className="border border-gray-300 px-2 py-1 font-mono">{p.numero_documento}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums">
                    Q {parseFloat(p.monto ?? "0").toLocaleString("es-GT", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-50">
                <td colSpan={2} className="border border-gray-300 px-2 py-1.5 text-right">Total</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums">
                  Q {total.toLocaleString("es-GT", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        <div className="flex justify-between items-end mt-4">
          <div className="text-center text-xs">
            <div className="border-t border-gray-500 mt-12 pt-1 w-48">
              <p className="font-semibold">{config?.nombre_responsable}</p>
              <p className="text-gray-500">Responsable FRI</p>
            </div>
          </div>
          <div className="border-2 border-gray-700 p-3 text-center min-w-[160px]">
            <p className="text-xs text-gray-500">Monto total</p>
            <p className="text-2xl font-bold">
              Q {total.toLocaleString("es-GT", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-center text-xs">
            <div className="border-t border-gray-500 mt-12 pt-1 w-48">
              <p className="font-semibold">Firma y Sello</p>
              <p className="text-gray-500">Beneficiario / Proveedor</p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400">{config?.municipio} · {hoy} · {config?.resolucion_fondo}</p>
    </div>
  );
}
