"use server";
import { db } from "@/lib/db";
import { actasNegociacion } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function getActaNegociacion(anio: number) {
  const [acta] = await db.select().from(actasNegociacion).where(eq(actasNegociacion.anio, anio)).limit(1);
  return acta ?? null;
}

export async function guardarActaNegociacion(anio: number, data: {
  contenido?: string; archivo_url?: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };
    if (session.user.rol !== "superadmin") return { error: "Solo el superadmin puede editar el Acta de Negociación" };

    const uid = Number(session.user.id);
    const [existente] = await db.select({ id: actasNegociacion.id }).from(actasNegociacion)
      .where(eq(actasNegociacion.anio, anio)).limit(1);

    if (existente) {
      await db.update(actasNegociacion).set({
        contenido: data.contenido ?? null, archivo_url: data.archivo_url ?? null,
        actualizado_por: uid, updated_at: new Date().toISOString(),
      }).where(eq(actasNegociacion.anio, anio));
    } else {
      await db.insert(actasNegociacion).values({
        anio, contenido: data.contenido ?? null, archivo_url: data.archivo_url ?? null,
        actualizado_por: uid,
      });
    }
    return { ok: true };
  } catch {
    return { error: "Error al guardar el Acta de Negociación" };
  }
}
