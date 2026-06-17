"use server";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { sql } from "@/lib/db";

export async function actualizarEfectivo(valor: number) {
  const [existing] = await db.select({ id: configuracion.id }).from(configuracion).limit(1);
  if (existing) {
    await db.update(configuracion)
      .set({ efectivo_caja: valor })
      .where(sql`id = ${existing.id}`);
  }
  return { ok: true };
}
