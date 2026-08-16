import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getLibroBancosCompleto } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import ImprimirLibroBancosClient from "./ImprimirLibroBancosClient";

interface Props { params: Promise<{ mes: string }> }

export default async function ImprimirLibroBancosPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { mes } = await params;
  if (!/^\d{4}-\d{2}$/.test(mes)) notFound();

  const [movimientos, [config]] = await Promise.all([
    getLibroBancosCompleto(),
    db.select().from(configuracion).limit(1),
  ]);

  const delMes = movimientos.filter(m => m.fecha.slice(0, 7) === mes);
  const saldoAnterior = movimientos.filter(m => m.fecha.slice(0, 7) < mes).at(-1)?.saldo
    ?? config?.monto_fondo_rotativo ?? 0;

  return (
    <ImprimirLibroBancosClient
      mes={mes}
      movimientos={delMes}
      saldoAnterior={saldoAnterior}
      nombreUnidad={config?.nombre_unidad ?? ""}
      municipio={config?.municipio ?? ""}
    />
  );
}
