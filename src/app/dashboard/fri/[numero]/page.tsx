import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { getFriPorNumero, agruparFriPorRenglon } from "@/lib/fri-actions";
import { getSaldoFondoRotativo } from "@/lib/vale-actions";
import ImprimirFriClient from "./ImprimirFriClient";

interface Props {
  params: Promise<{ numero: string }>;
  searchParams: Promise<{ anio?: string }>;
}

export default async function FriImprimirPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { numero } = await params;
  const { anio } = await searchParams;
  const [res, saldo] = await Promise.all([
    getFriPorNumero(Number(numero), anio ? Number(anio) : new Date().getFullYear()),
    getSaldoFondoRotativo(),
  ]);
  if (!res) notFound();

  const [config, grupos, firmantes] = await Promise.all([
    db.select().from(configuracion).limit(1).then(r => r[0]),
    agruparFriPorRenglon(res.pagos, res.polizas),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  return (
    <ImprimirFriClient
      fri={res.fri}
      grupos={grupos}
      saldo={saldo}
      nombreUnidad={config?.nombre_unidad ?? "Consultorio de Tacaná, Departamento de San Marcos"}
      firmantes={firmantes as any}
    />
  );
}
