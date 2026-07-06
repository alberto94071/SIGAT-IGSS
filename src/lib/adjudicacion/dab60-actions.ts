"use server";
import { db } from "@/lib/db";
import { ordenesCompra, presupuestoRenglones } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { gruposRenglonDeConsolidacion } from "./renglon-utils";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export async function getOrdenesEnDab() {
  return db.select().from(ordenesCompra).where(eq(ordenesCompra.estado, "En DAB")).orderBy(sql`created_at ASC`);
}

// Al ingresar la orden al DAB-60: precio unitario (el que Compras cargó en
// "Generar Orden de Compra") × la cantidad de cada renglón/subproducto que
// trae la solicitud, sumado (no reemplazado) a Compromiso y a Devengado de
// Presupuesto General para ese mismo renglón/subproducto.
export async function procesarDab60(ordenId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    const [orden] = await db.select().from(ordenesCompra).where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "En DAB") return { error: "Esta orden ya fue procesada en DAB-60" };
    if (orden.costo_unitario == null) return { error: "La orden no tiene precio unitario registrado" };

    const grupos = await gruposRenglonDeConsolidacion(orden.consolidacion_id);
    for (const g of grupos) {
      if (g.renglon == null) continue;
      const monto = g.cantidad * orden.costo_unitario;
      await db.update(presupuestoRenglones).set({
        compromiso: sql`COALESCE(${presupuestoRenglones.compromiso}, 0) + ${monto}`,
        devengado:  sql`COALESCE(${presupuestoRenglones.devengado}, 0) + ${monto}`,
      }).where(and(
        eq(presupuestoRenglones.renglon, g.renglon),
        eq(presupuestoRenglones.subproducto, g.subproducto),
        eq(presupuestoRenglones.ejercicio_fiscal, 2026),
      ));
    }

    await db.update(ordenesCompra).set({ estado: "Completada" }).where(eq(ordenesCompra.id, ordenId));
    return { ok: true };
  } catch {
    return { error: "Error al procesar la orden en DAB-60" };
  }
}
