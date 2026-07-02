"use server";
import { db } from "@/lib/db";
import { notificaciones } from "@/lib/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function getMisNotificaciones() {
  const session = await auth();
  if (!session) return { notificaciones: [], noLeidas: 0 };
  const uid = Number(session.user.id);

  const [rows, [{ count }]] = await Promise.all([
    db.select().from(notificaciones)
      .where(eq(notificaciones.usuario_id, uid))
      .orderBy(desc(notificaciones.id))
      .limit(20),
    db.select({ count: sql<number>`count(*)::int` })
      .from(notificaciones)
      .where(and(eq(notificaciones.usuario_id, uid), eq(notificaciones.leida, false))),
  ]);

  return { notificaciones: rows, noLeidas: count };
}

export async function marcarNotificacionLeida(id: number) {
  const session = await auth();
  if (!session) return { error: "No autenticado" };
  const uid = Number(session.user.id);
  await db.update(notificaciones)
    .set({ leida: true })
    .where(and(eq(notificaciones.id, id), eq(notificaciones.usuario_id, uid)));
  return { ok: true };
}

export async function marcarTodasLeidas() {
  const session = await auth();
  if (!session) return { error: "No autenticado" };
  const uid = Number(session.user.id);
  await db.update(notificaciones)
    .set({ leida: true })
    .where(and(eq(notificaciones.usuario_id, uid), eq(notificaciones.leida, false)));
  return { ok: true };
}
