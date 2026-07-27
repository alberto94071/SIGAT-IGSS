import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getFriPorNumero } from "@/lib/fri-actions";
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
  const res = await getFriPorNumero(Number(numero), anio ? Number(anio) : new Date().getFullYear());
  if (!res) notFound();

  const [config] = await db.select().from(configuracion).limit(1);

  return (
    <ImprimirFriClient
      fri={res.fri}
      pagos={res.pagos}
      polizas={res.polizas}
      nombreUnidad={config?.nombre_unidad ?? "Consultorio de Tacaná, Departamento de San Marcos"}
      nombreEncargado={config?.nombre_encargado_unidad ?? "Lilia Zucely Pérez Fuentes"}
      cargoEncargado={config?.cargo_encargado_unidad ?? 'Analista "A"'}
    />
  );
}
