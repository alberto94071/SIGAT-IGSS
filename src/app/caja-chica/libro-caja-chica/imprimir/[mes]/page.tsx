import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getLibroCajaChicaCompleto } from "@/lib/caja-chica-liquidacion-actions";
import ImprimirLibroCajaChicaClient from "./ImprimirLibroCajaChicaClient";

interface Props { params: Promise<{ mes: string }> }

export default async function ImprimirLibroCajaChicaPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { mes } = await params;
  if (!/^\d{4}-\d{2}$/.test(mes)) notFound();

  const [filas, [config]] = await Promise.all([
    getLibroCajaChicaCompleto(),
    db.select().from(configuracion).limit(1),
  ]);

  const delMes = filas.filter(f => (f.fecha_pago ?? "").slice(0, 7) === mes);

  return (
    <ImprimirLibroCajaChicaClient
      mes={mes}
      filas={delMes}
      nombreUnidad={config?.nombre_unidad ?? ""}
      municipio={config?.municipio ?? ""}
    />
  );
}
