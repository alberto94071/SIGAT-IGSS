import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { actasAdjudicacion, consolidaciones, configuracion, siafCompras } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { marcarActaPrevisualizada } from "@/lib/adjudicacion/actas-adjudicacion-actions";
import ImprimirActaClient from "./ImprimirActaClient";

interface Props { params: Promise<{ id: string }> }

export default async function ImprimirActaPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const [acta] = await db.select().from(actasAdjudicacion).where(eq(actasAdjudicacion.id, Number(id))).limit(1);
  if (!acta) notFound();

  const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, acta.consolidacion_id)).limit(1);
  if (!con) notFound();

  const siafs = await db.select({ numero: siafCompras.numero, anio: siafCompras.anio })
    .from(siafCompras).where(eq(siafCompras.consolidacion_id, con.id));

  const [config] = await db.select().from(configuracion).limit(1);

  if (!acta.previsualizada) {
    await marcarActaPrevisualizada(acta.id);
  }

  return (
    <ImprimirActaClient
      acta={acta as any}
      consolidacion={con as any}
      siafs={siafs}
      nombreUnidad={config?.nombre_unidad_ejecutora ?? config?.nombre_unidad ?? ""}
      direccionUnidad={config?.direccion_unidad ?? ""}
    />
  );
}
