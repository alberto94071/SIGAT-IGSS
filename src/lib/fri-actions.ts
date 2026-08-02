"use server";
import { db } from "@/lib/db";
import { fondoRotativoPagos, friFondoRotativo, consolidaciones, configuracion, polizas } from "@/lib/schema";
import { eq, inArray, sql, desc, and, isNull, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { conDetalle, type PagoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export type Fri = {
  id: number; numero: number; anio: number; total: number; estado: string;
  fecha_envio_daf: string | null; fecha_reintegro: string | null; created_at: string | null;
};
export type PolizaFri = { id: number; numero: number; fecha: string; total: number; estado: string };

export async function getPagosPendientesFri(): Promise<PagoFondoRotativo[]> {
  const rows = await db.select().from(fondoRotativoPagos)
    .where(eq(fondoRotativoPagos.estado, "Pendiente FRI"));
  return conDetalle(rows);
}

// Pólizas de pasajes ya pagadas (con vale asignado) que todavía no se han
// reportado en ningún FRI. Su ciclo de liquidación (Caja Chica) sigue
// exactamente igual — el FRI solo las agrupa para pedir el reintegro.
export async function getPolizasPendientesFri(): Promise<PolizaFri[]> {
  return db.select({ id: polizas.id, numero: polizas.numero, fecha: polizas.fecha, total: polizas.total, estado: polizas.estado })
    .from(polizas)
    .where(and(isNotNull(polizas.vale_id), isNull(polizas.fri_id)))
    .orderBy(desc(polizas.numero));
}

export async function getFrisConformados(): Promise<Fri[]> {
  return db.select().from(friFondoRotativo).orderBy(desc(friFondoRotativo.anio), desc(friFondoRotativo.numero));
}

export async function getFriConDetalle(friId: number): Promise<{ fri: Fri; pagos: PagoFondoRotativo[]; polizas: PolizaFri[] } | null> {
  const [fri] = await db.select().from(friFondoRotativo).where(eq(friFondoRotativo.id, friId)).limit(1);
  if (!fri) return null;
  const [pagoRows, polizaRows] = await Promise.all([
    db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.fri_id, friId)),
    db.select({ id: polizas.id, numero: polizas.numero, fecha: polizas.fecha, total: polizas.total, estado: polizas.estado })
      .from(polizas).where(eq(polizas.fri_id, friId)),
  ]);
  return { fri, pagos: await conDetalle(pagoRows), polizas: polizaRows };
}

export async function getFriPorNumero(numero: number, anio: number) {
  const [fri] = await db.select().from(friFondoRotativo)
    .where(sql`${friFondoRotativo.numero} = ${numero} AND ${friFondoRotativo.anio} = ${anio}`).limit(1);
  if (!fri) return null;
  return getFriConDetalle(fri.id);
}

export type FriItemInput = { tipo: "pago" | "poliza"; id: number };

// Agrupa varios pagos "Pendiente FRI" (renglones 100-199 ya pagados por
// cheque o vale) y/o pólizas de pasajes ya pagadas, bajo un correlativo
// nuevo — el FRI que se imprime y se lleva físicamente a Fondo Rotativo
// para reportar en qué se gastó y pedir el reintegro. No es un mecanismo de
// pago: agrupar una póliza aquí no cambia su propio ciclo de liquidación.
export async function conformarFri(items: FriItemInput[]): Promise<{ ok: true; fri: Fri } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (items.length === 0) return { error: "Selecciona al menos un elemento" };

    const pagoIds = items.filter(i => i.tipo === "pago").map(i => i.id);
    const polizaIds = items.filter(i => i.tipo === "poliza").map(i => i.id);

    const [pagos, polizasSel] = await Promise.all([
      pagoIds.length > 0 ? db.select().from(fondoRotativoPagos).where(inArray(fondoRotativoPagos.id, pagoIds)) : Promise.resolve([]),
      polizaIds.length > 0 ? db.select().from(polizas).where(inArray(polizas.id, polizaIds)) : Promise.resolve([]),
    ]);
    if (pagos.length !== pagoIds.length) return { error: "Alguno de los pagos seleccionados no existe" };
    if (pagos.some(p => p.estado !== "Pendiente FRI" || p.fri_id != null))
      return { error: "Alguno de los pagos seleccionados ya no está disponible para conformar un FRI" };
    if (polizasSel.length !== polizaIds.length) return { error: "Alguna de las pólizas seleccionadas no existe" };
    if (polizasSel.some(p => p.vale_id == null || p.fri_id != null))
      return { error: "Alguna de las pólizas seleccionadas ya no está disponible para conformar un FRI" };

    const cons = pagos.length > 0
      ? await db.select({ id: consolidaciones.id, total: consolidaciones.total })
          .from(consolidaciones).where(inArray(consolidaciones.id, pagos.map(p => p.consolidacion_id)))
      : [];
    const totalMap = new Map(cons.map(c => [c.id, c.total ?? 0]));
    const totalPagos = pagos.reduce((s, p) => s + (totalMap.get(p.consolidacion_id) ?? 0), 0);
    const totalPolizas = polizasSel.reduce((s, p) => s + p.total, 0);
    const total = totalPagos + totalPolizas;

    const anio = new Date().getFullYear();
    const res = await db.execute(sql`SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM fri_fondo_rotativo WHERE anio = ${anio}`);
    const numero = Number((res.rows[0] as any).next) || 1;

    const [fri] = await db.insert(friFondoRotativo).values({
      numero, anio, total, estado: "Generado", creado_por: check.uid,
    }).returning();

    if (pagoIds.length > 0) {
      await db.update(fondoRotativoPagos).set({ fri_id: fri.id, estado: "En FRI" })
        .where(inArray(fondoRotativoPagos.id, pagoIds));
    }
    if (polizaIds.length > 0) {
      // Solo se marca fri_id — el estado de la póliza (Enviada a Liquidar /
      // Liquidada) sigue su propio camino en Caja Chica, sin tocarlo.
      await db.update(polizas).set({ fri_id: fri.id }).where(inArray(polizas.id, polizaIds));
    }

    return { ok: true, fri };
  } catch {
    return { error: "Error al conformar el FRI" };
  }
}

// El FRI conformado se remite a la división de Fondo Rotativo/DAF para
// trámite del reintegro — se registra la fecha de envío y queda "Enviado",
// esperando que se marque Reintegrado (o Rechazado si lo devuelven).
export async function enviarFriADaf(friId: number, fechaEnvioDaf: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (!fechaEnvioDaf) return { error: "La fecha de envío es obligatoria" };

    const [fri] = await db.select({ estado: friFondoRotativo.estado }).from(friFondoRotativo).where(eq(friFondoRotativo.id, friId)).limit(1);
    if (!fri) return { error: "No se encontró el FRI" };
    if (fri.estado !== "Generado" && fri.estado !== "Rechazado") {
      return { error: "Este FRI ya fue enviado o reintegrado" };
    }

    await db.update(friFondoRotativo).set({
      estado: "Enviado", fecha_envio_daf: fechaEnvioDaf,
    }).where(eq(friFondoRotativo.id, friId));

    return { ok: true };
  } catch {
    return { error: "Error al enviar el FRI a la DAF" };
  }
}

// Lo devolvieron: se puede corregir y volver a enviar con enviarFriADaf.
export async function marcarFriRechazado(friId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    const [fri] = await db.select({ estado: friFondoRotativo.estado }).from(friFondoRotativo).where(eq(friFondoRotativo.id, friId)).limit(1);
    if (!fri) return { error: "No se encontró el FRI" };
    if (fri.estado !== "Enviado") return { error: "Solo se puede rechazar mientras está Enviado" };

    await db.update(friFondoRotativo).set({ estado: "Rechazado" }).where(eq(friFondoRotativo.id, friId));

    return { ok: true };
  } catch {
    return { error: "Error al rechazar el FRI" };
  }
}

// Cuando en la vida real Fondo Rotativo deposita el reintegro de este FRI, se
// marca aquí — acredita el total al saldo disponible del Fondo Rotativo
// (configuracion.efectivo_caja), para que Caja Chica pueda volver a sacar
// vales con ese dinero. Los pagos de gastos varios quedan archivados como
// "Reintegrado"; las pólizas de pasajes NO se tocan — su liquidación en Caja
// Chica sigue siendo un proceso aparte.
export async function marcarFriReintegrado(friId: number, fechaReintegro: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (!fechaReintegro) return { error: "La fecha de reintegro es obligatoria" };

    const [fri] = await db.select().from(friFondoRotativo).where(eq(friFondoRotativo.id, friId)).limit(1);
    if (!fri) return { error: "No se encontró el FRI" };
    if (fri.estado !== "Enviado") return { error: "El FRI debe estar Enviado a la DAF antes de marcarlo como reintegrado" };

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
