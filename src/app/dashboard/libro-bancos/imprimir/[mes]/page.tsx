import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { getRegistroBancos, agruparPorCheque } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import ImprimirLibroBancosClient from "./ImprimirLibroBancosClient";

interface Props { params: Promise<{ mes: string }>; searchParams: Promise<{ saldoCorte?: string }> }

export default async function ImprimirLibroBancosPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { mes } = await params;
  const { saldoCorte } = await searchParams;
  if (!/^\d{4}-\d{2}$/.test(mes)) notFound();

  const [movimientos, [config], firmantes] = await Promise.all([
    getRegistroBancos(),
    db.select().from(configuracion).limit(1),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  // Mismo criterio que Libro Caja Chica: el saldo con el que arranca el mes
  // es el saldo del último movimiento ANTES de este mes — monto_fondo_
  // rotativo si es el primer mes con movimientos (getRegistroBancos ya
  // arranca su propio saldo corriente ahí, así que no hace falta pedirlo a
  // mano como en Libro Viáticos). Se calcula sobre los movimientos SIN
  // agrupar — agrupar varios pagos bajo un mismo cheque (ver
  // agruparPorCheque) puede reposicionar la fila combinada en la fecha del
  // último pago del grupo, y eso no debe alterar qué transacción real fue
  // la última antes de este mes.
  const anteriores = movimientos.filter(m => m.fecha.slice(0, 7) < mes);
  const saldoAnterior = anteriores.length > 0 ? anteriores[anteriores.length - 1].saldo : (config?.monto_fondo_rotativo ?? 0);
  // La agrupación por cheque (pedido del cliente 2026-09-20: "solo necesito
  // que aparezca un cheque con el nombre de a quién se lo hice y cuál fué el
  // monto total") solo aplica a lo que se MUESTRA/imprime del mes, nunca al
  // cálculo de saldoAnterior de arriba.
  const delMes = (await agruparPorCheque(movimientos)).filter(m => m.fecha.slice(0, 7) === mes);

  return (
    <ImprimirLibroBancosClient
      mes={mes}
      movimientos={delMes}
      saldoAnterior={saldoAnterior}
      nombreUnidad={config?.nombre_unidad ?? ""}
      municipio={config?.municipio ?? ""}
      firmantes={firmantes as any}
      saldoCorteInicial={saldoCorte ?? ""}
    />
  );
}
