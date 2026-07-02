import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { consolidaciones, configuracion } from "@/lib/schema";
import { eq } from "drizzle-orm";
import ConformidadClient from "./ConformidadClient";

interface Props { params: Promise<{ id: string }> }

export default async function ConformidadPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, Number(id))).limit(1);
  if (!con) notFound();

  const [config] = await db.select().from(configuracion).limit(1);

  return (
    <ConformidadClient
      consolidacion={con as any}
      nombreUnidad={config?.nombre_unidad_ejecutora ?? config?.nombre_unidad ?? ""}
      direccionUnidad={config?.direccion_unidad ?? ""}
    />
  );
}
