"use server";
import { db } from "@/lib/db";
import { fondoRotativoPagos, friFondoRotativo, consolidaciones, configuracion } from "@/lib/schema";
import { eq, inArray, sql, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { conDetalle, type PagoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export type Fri = { id: number; numero: number; anio: number; total: number; estado: string; fecha_reintegro: string | null; created_at: string | null };

export async function getPagosPendientesFri(): Promise<PagoFondoRotativo[]> {
  const rows = await db.select().from(fondoRotativoPagos)
    .where(eq(fondoRotativoPagos.estado, "Pendiente FRI"));
  return conDetalle(rows);
}

export async function getFrisConformados(): Promise<Fri[]> {
  return db.select().from(friFondoRotativo).orderBy(desc(friFondoRotativo.anio), desc(friFondoRotativo.numero));
}

export async function getFriConDetalle(friId: number): Promise<{ fri: Fri; items: PagoFondoRotativo[] } | null> {
  const [fri] = await db.select().from(friFondoRotativo).where(eq(friFondoRotativo.id, friId)).limit(1);
  if (!fri) return null;
  const rows = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.fri_id, friId));
  return { fri, items: await conDetalle(rows) };
}

export async function getFriPorNumero(numero: number, anio: number): Promise<{ fri: Fri; items: PagoFondoRotativo[] } | null> {
  const [fri] = await db.select().from(friFondoRotativo)
    .where(sql`${friFondoRotativo.numero} = ${numero} AND ${friFondoRotativo.anio} = ${anio}`).limit(1);
  if (!fri) return null;
  return getFriConDetalle(fri.id);
}

// Agrupa varios pagos "Pendiente FRI" (renglones 100-199 ya pagados por cheque
// o vale) bajo un correlativo nuevo — el FRI que se imprime y se lleva
// físicamente a Fondo Rotativo para pedir el reintegro.
export async function conformarFri(pagoIds: number[]): Promise<{ ok: true; fri: Fri } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (pagoIds.length === 0) return { error: "Selecciona al menos un pago" };

    const pagos = await db.select().from(fondoRotativoPagos).where(inArray(fondoRotativoPagos.id, pagoIds));
    if (pagos.length !== pagoIds.length) return { error: "Alguno de los pagos seleccionados no existe" };
    if (pagos.some(p => p.estado !== "Pendiente FRI" || p.fri_id != null))
      return { error: "Alguno de los pagos seleccionados ya no está disponible para conformar un FRI" };

    const cons = await db.select({ id: consolidaciones.id, total: consolidaciones.total })
      .from(consolidaciones).where(inArray(consolidaciones.id, pagos.map(p => p.consolidacion_id)));
    const totalMap = new Map(cons.map(c => [c.id, c.total ?? 0]));
    const total = pagos.reduce((s, p) => s + (totalMap.get(p.consolidacion_id) ?? 0), 0);

    const anio = new Date().getFullYear();
    const res = await db.execute(sql`SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM fri_fondo_rotativo WHERE anio = ${anio}`);
    const numero = Number((res.rows[0] as any).next) || 1;

    const [fri] = await db.insert(friFondoRotativo).values({
      numero, anio, total, estado: "Generado", creado_por: check.uid,
    }).returning();

    await db.update(fondoRotativoPagos).set({ fri_id: fri.id, estado: "En FRI" })
      .where(inArray(fondoRotativoPagos.id, pagoIds));

    return { ok: true, fri };
  } catch {
    return { error: "Error al conformar el FRI" };
  }
}

// Cuando en la vida real Fondo Rotativo deposita el reintegro de este FRI, se
// marca aquí — acredita el total al saldo disponible del Fondo Rotativo
// (configuracion.efectivo_caja) y archiva los pagos incluidos.
export async function marcarFriReintegrado(friId: number, fechaReintegro: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (!fechaReintegro) return { error: "La fecha de reintegro es obligatoria" };

    const [fri] = await db.select().from(friFondoRotativo).where(eq(friFondoRotativo.id, friId)).limit(1);
    if (!fri) return { error: "No se encontró el FRI" };
    if (fri.estado !== "Generado") return { error: "Este FRI ya fue marcado como reintegrado" };

    await db.update(friFondoRotativo).set({
      estado: "Reintegrado", fecha_reintegro: fechaReintegro,
    }).where(eq(friFondoRotativo.id, friId));

    await db.update(fondoRotativoPagos).set({ estado: "Reintegrado" }).where(eq(fondoRotativoPagos.fri_id, friId));

    await db.update(configuracion).set({
      efectivo_caja: sql`COALESCE(${configuracion.efectivo_caja}, 0) + ${fri.total}`,
    });

    return { ok: true };
  } catch {
    return { error: "Error al marcar el FRI como reintegrado" };
  }
}
