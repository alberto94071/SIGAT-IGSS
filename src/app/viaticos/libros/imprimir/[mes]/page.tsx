import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getLibroViaticos } from "../../actions";
import ImprimirLibroViaticosClient from "./ImprimirLibroViaticosClient";

interface Props {
  params: Promise<{ mes: string }>;
  searchParams: Promise<{ existencia?: string; folio?: string }>;
}

export default async function ImprimirLibroViaticosPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { mes } = await params;
  if (!/^\d{4}-\d{2}$/.test(mes)) notFound();
  const { existencia, folio } = await searchParams;

  const [movimientos, [config]] = await Promise.all([
    getLibroViaticos(mes),
    db.select().from(configuracion).limit(1),
  ]);

  return (
    <ImprimirLibroViaticosClient
      mes={mes}
      movimientos={movimientos}
      existenciaInicial={Number(existencia) || 0}
      folio={folio ?? ""}
      nombreUnidad={config?.nombre_unidad ?? ""}
      municipio={config?.municipio ?? ""}
    />
  );
}
