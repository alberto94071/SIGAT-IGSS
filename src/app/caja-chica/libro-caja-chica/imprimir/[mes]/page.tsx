import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getLibroCajaChicaLedger } from "@/lib/caja-chica-liquidacion-actions";
import ImprimirLibroCajaChicaClient from "./ImprimirLibroCajaChicaClient";

interface Props { params: Promise<{ mes: string }> }

export default async function ImprimirLibroCajaChicaPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { mes } = await params;
  if (!/^\d{4}-\d{2}$/.test(mes)) notFound();

  const [movimientos, [config]] = await Promise.all([
    getLibroCajaChicaLedger(),
    db.select().from(configuracion).limit(1),
  ]);

  const delMes = movimientos.filter(m => m.fecha.slice(0, 7) === mes);
  // Saldo con el que arranca el mes = saldo del último movimiento ANTES de
  // este mes (0 si es el primer mes con movimientos).
  const anteriores = movimientos.filter(m => m.fecha.slice(0, 7) < mes);
  const saldoInicial = anteriores.length > 0 ? anteriores[anteriores.length - 1].saldo : 0;

  return (
    <ImprimirLibroCajaChicaClient
      mes={mes}
      movimientos={delMes}
      saldoInicial={saldoInicial}
      nombreUnidad={config?.nombre_unidad ?? ""}
      municipio={config?.municipio ?? ""}
    />
  );
}
