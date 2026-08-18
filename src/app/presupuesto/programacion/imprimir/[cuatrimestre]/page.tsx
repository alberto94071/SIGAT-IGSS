import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { getEntradas } from "@/lib/programacion-actions";
import { CUATRIMESTRES } from "@/lib/programacion-constants";
import ImprimirProgramacionClient from "./ImprimirProgramacionClient";

interface Props {
  params: Promise<{ cuatrimestre: string }>;
  searchParams: Promise<{ modo?: string }>;
}

export default async function ImprimirProgramacionPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { cuatrimestre: cuatrimestreParam } = await params;
  const { modo } = await searchParams;
  const cuatrimestre = Number(cuatrimestreParam);
  const cuatrimestreInfo = CUATRIMESTRES.find(c => c.id === cuatrimestre);
  if (!cuatrimestreInfo) notFound();

  const [entradas, [config], firmantes] = await Promise.all([
    getEntradas(cuatrimestre),
    db.select().from(configuracion).limit(1),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  return (
    <ImprimirProgramacionClient
      esReprogramacion={modo === "reprogramacion"}
      cuatrimestre={cuatrimestre}
      cuatrimestreLabel={cuatrimestreInfo.label}
      entradas={entradas}
      nombreUnidad={config?.nombre_unidad ?? ""}
      firmantes={firmantes as any}
    />
  );
}
