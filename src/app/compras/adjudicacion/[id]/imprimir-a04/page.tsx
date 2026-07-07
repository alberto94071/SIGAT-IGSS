import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { consolidaciones, configuracion } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { gruposRenglonDeConsolidacion } from "@/lib/adjudicacion/renglon-utils";
import ImprimirA04Client from "./ImprimirA04Client";

interface Props { params: Promise<{ id: string }> }

export default async function ImprimirA04Page({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, Number(id))).limit(1);
  if (!con || !con.numero_a04) notFound();

  const [config] = await db.select().from(configuracion).limit(1);

  const renglones = await gruposRenglonDeConsolidacion(con.id);

  return (
    <ImprimirA04Client
      consolidacion={con as any}
      renglones={renglones}
      nombreUnidad={config?.nombre_unidad ?? ""}
      codigoUnidad={config?.codigo_unidad ?? ""}
      direccionUnidad={config?.direccion_unidad ?? ""}
      municipio={config?.municipio ?? ""}
      nombreResponsable={config?.nombre_responsable ?? ""}
      nombreAnalistaPresupuesto={config?.nombre_analista_presupuesto ?? ""}
      nombreDirector={config?.nombre_director ?? ""}
    />
  );
}
