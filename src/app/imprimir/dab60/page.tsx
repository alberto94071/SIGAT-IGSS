import { db } from "@/lib/db";
import { pagos, configuracion } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import PrintButtons from "@/components/PrintButtons";

export default async function DAB60PrintPage({
  searchParams,
}: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  if (!id) notFound();

  const [pago] = await db.select().from(pagos).where(eq(pagos.id, Number(id)));
  if (!pago) notFound();
  const [config] = await db.select().from(configuracion).limit(1);

  const hoy = new Date().toLocaleDateString("es-GT", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <div className="p-8 max-w-3xl mx-auto text-sm font-sans">
      <PrintButtons />

      <div className="border-2 border-gray-800 p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs text-gray-500">{config?.municipio}</p>
            <p className="text-xs text-gray-500">{config?.codigo_contable} — {config?.nombre_unidad}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold"># DAB-60</p>
            <p className="text-xl font-bold text-gray-800">{pago.numero_dab ?? `C-${pago.id}`}</p>
          </div>
        </div>

        <h1 className="text-center text-base font-bold uppercase border-y border-gray-400 py-2 my-4">
          Documento de Abono — DAB-60
        </h1>

        <div className="grid grid-cols-2 gap-4 text-xs mb-4">
          <div className="space-y-1">
            <p><strong>Fecha:</strong> {hoy}</p>
            <p><strong>No. Serie:</strong> {pago.numero_serie ?? "—"}</p>
            <p><strong>Renglón:</strong> {pago.renglon}</p>
          </div>
          <div className="space-y-1">
            <p><strong>Correlativo SIAF:</strong> {pago.siaf_numero ?? "—"}</p>
            <p><strong>N° Oficio:</strong> ___________</p>
            <p><strong>Cuatrimestre:</strong> {pago.cuatrimestre}</p>
          </div>
        </div>

        <div className="border border-gray-400 p-3 mb-4 text-xs space-y-1.5">
          <p><strong>Proveedor:</strong> {pago.proveedor}</p>
          <p><strong>NIT:</strong> {pago.nit_proveedor}</p>
          <p><strong>Descripción:</strong> {pago.descripcion}</p>
          <p><strong>N° Documento:</strong> {pago.numero_documento} &nbsp;·&nbsp; <strong>Serie:</strong> {pago.numero_serie}</p>
          <p><strong>Fecha documento:</strong> {pago.fecha_documento}</p>
        </div>

        <div className="border border-gray-800 p-4 text-center mb-6">
          <p className="text-xs text-gray-500 mb-1">Monto total</p>
          <p className="text-2xl font-bold">
            Q {parseFloat(pago.monto ?? "0").toLocaleString("es-GT", { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Firmas */}
        <div className="grid grid-cols-2 gap-8 mt-10 text-xs text-center">
          <div>
            <div className="border-t border-gray-600 pt-2 mt-8">
              <p className="font-semibold">{config?.nombre_responsable}</p>
              <p className="text-gray-500">Responsable FRI</p>
            </div>
          </div>
          <div>
            <div className="border-t border-gray-600 pt-2 mt-8">
              <p className="font-semibold">Firma y Sello</p>
              <p className="text-gray-500">Proveedor / Beneficiario</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
