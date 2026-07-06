"use server";
import { db } from "@/lib/db";
import { ordenesCompra } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { gruposRenglonDeConsolidacion } from "./renglon-utils";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export async function getOrdenesEnCompromiso() {
  const ordenes = await db.select().from(ordenesCompra).where(eq(ordenesCompra.estado, "En Compromiso")).orderBy(sql`created_at ASC`);
  return Promise.all(ordenes.map(async o => ({
    ...o, renglones: await gruposRenglonDeConsolidacion(o.consolidacion_id),
  })));
}

export async function comprometerYEnviarADevengado(ordenId: number, noCompromiso: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (!noCompromiso.trim()) return { error: "El No. de Compromiso es obligatorio" };

    const [orden] = await db.select({ estado: ordenesCompra.estado }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "En Compromiso") return { error: "Esta orden ya fue enviada a Devengado" };

    await db.update(ordenesCompra).set({
      no_compromiso: noCompromiso.trim(), estado: "En Devengado",
    }).where(eq(ordenesCompra.id, ordenId));

    return { ok: true };
  } catch {
    return { error: "Error al registrar el compromiso" };
  }
}
