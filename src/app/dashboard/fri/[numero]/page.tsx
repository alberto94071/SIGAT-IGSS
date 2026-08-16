import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
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

  const [config, grupos] = await Promise.all([
    db.select().from(configuracion).limit(1).then(r => r[0]),
    agruparFriPorRenglon(res.pagos, res.polizas),
  ]);

  return (
    <ImprimirFriClient
      fri={res.fri}
      grupos={grupos}
      saldo={saldo}
      nombreUnidad={config?.nombre_unidad ?? "Consultorio de Tacaná, Departamento de San Marcos"}
      nombreEncargado={config?.nombre_encargado_unidad ?? "Lilia Zucely Pérez Fuentes"}
      cargoEncargado={config?.cargo_encargado_unidad ?? 'Analista "A"'}
    />
  );
}
