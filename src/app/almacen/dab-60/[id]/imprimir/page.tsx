import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ordenesCompra } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { gruposRenglonDeConsolidacion } from "@/lib/adjudicacion/renglon-utils";
import ImprimirDab60Client from "./ImprimirDab60Client";

interface Props { params: Promise<{ id: string }> }

export default async function ImprimirDab60Page({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const [orden] = await db.select().from(ordenesCompra).where(eq(ordenesCompra.id, Number(id))).limit(1);
  if (!orden || !orden.dab60_generado_en) notFound();

  if (orden.dab60_anulado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">DAB-60 anulado</h1>
          <p className="text-sm text-gray-500">
            Este DAB-60 fue anulado al devolver la orden a Compras/Adjudicación — ya no se puede imprimir.
          </p>
        </div>
      </div>
    );
  }

  const renglones = await gruposRenglonDeConsolidacion(orden.consolidacion_id);

  return <ImprimirDab60Client orden={orden as any} renglones={renglones} />;
}
