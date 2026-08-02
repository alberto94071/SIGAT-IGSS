import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
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

  const entradas = await getEntradas(cuatrimestre);
  const [config] = await db.select().from(configuracion).limit(1);

  return (
    <ImprimirProgramacionClient
      esReprogramacion={modo === "reprogramacion"}
      cuatrimestre={cuatrimestre}
      cuatrimestreLabel={cuatrimestreInfo.label}
      entradas={entradas}
      nombreUnidad={config?.nombre_unidad ?? ""}
      nombreEncargado={config?.nombre_encargado_unidad ?? ""}
      cargoEncargado={config?.cargo_encargado_unidad ?? ""}
    />
  );
}
