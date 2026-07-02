import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getActaNegociacion } from "@/lib/adjudicacion/actas-actions";
import ImprimirActaClient from "./ImprimirActaClient";

interface Props { params: Promise<{ anio: string }> }

export default async function ImprimirActaPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { anio: anioParam } = await params;
  const anio = Number(anioParam);
  if (!anio) notFound();

  const [acta, config] = await Promise.all([
    getActaNegociacion(anio),
    db.select().from(configuracion).limit(1),
  ]);

  return (
    <ImprimirActaClient
      anio={anio}
      contenido={acta?.contenido ?? ""}
      nombreUnidad={config[0]?.nombre_unidad_ejecutora ?? config[0]?.nombre_unidad ?? ""}
    />
  );
}
