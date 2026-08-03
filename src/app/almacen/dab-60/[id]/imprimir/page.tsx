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

  const renglones = await gruposRenglonDeConsolidacion(orden.consolidacion_id);

  return <ImprimirDab60Client orden={orden as any} renglones={renglones} />;
}
