"use server";
import { db } from "@/lib/db";
import { ordenesCompra, consolidaciones, presupuestoRenglones } from "@/lib/schema";
import { eq, sql, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { gruposRenglonDeConsolidacion } from "./renglon-utils";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export async function getOrdenesEnDevengado() {
  const ordenes = await db.select().from(ordenesCompra).where(eq(ordenesCompra.estado, "En Devengado")).orderBy(sql`created_at ASC`);
  return Promise.all(ordenes.map(async o => ({
    ...o, renglones: await gruposRenglonDeConsolidacion(o.consolidacion_id),
  })));
}

// Devengar es un solo clic: no pide datos (la factura/lote/marca/etc. ya se
// capturaron — opcionalmente — al pasar por Almacén/DAB-60, o ni siquiera
// aplican si el renglón es un servicio que se saltó Almacén). Mueve el monto
// de Compromiso a Ejecutado (Devengado), separando Normal/Regularizado según
// cómo se adjudicó la consolidación original.
export async function devengar(ordenId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    const [orden] = await db.select({
      estado: ordenesCompra.estado,
      consolidacion_id: ordenesCompra.consolidacion_id,
    }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "En Devengado") return { error: "Esta orden ya fue devengada" };

    const [con] = await db.select({ regularizado: consolidaciones.regularizado })
      .from(consolidaciones).where(eq(consolidaciones.id, orden.consolidacion_id)).limit(1);
    const esRegularizado = con?.regularizado === true;

    await db.update(ordenesCompra).set({ estado: "Completada" }).where(eq(ordenesCompra.id, ordenId));

    const renglones = await gruposRenglonDeConsolidacion(orden.consolidacion_id);
    for (const r of renglones) {
      await db.update(presupuestoRenglones).set({
        compromiso: sql`COALESCE(${presupuestoRenglones.compromiso}, 0) - ${r.total}`,
        ...(esRegularizado
          ? { devengado_regularizado: sql`COALESCE(${presupuestoRenglones.devengado_regularizado}, 0) + ${r.total}` }
          : { devengado: sql`COALESCE(${presupuestoRenglones.devengado}, 0) + ${r.total}` }),
      }).where(and(
        eq(presupuestoRenglones.renglon, r.renglon as number),
        eq(presupuestoRenglones.subproducto, r.subproducto),
        eq(presupuestoRenglones.ejercicio_fiscal, 2026)
      ));
    }

    return { ok: true };
  } catch {
    return { error: "Error al registrar el devengado" };
  }
}
