"use server";
import { db } from "@/lib/db";
import { catalogoFirmantes } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

async function requireSuperadmin() {
  const s = await auth();
  if (!s || s.user.rol !== "superadmin") throw new Error("Sin permiso");
}

export async function crearFirmante(data: { nombre: string; cargo: string }) {
  await requireSuperadmin();
  const [row] = await db.insert(catalogoFirmantes).values({
    nombre: data.nombre.trim().toUpperCase(),
    cargo:  data.cargo.trim(),
  }).returning();
  return { firmante: row };
}

export async function editarFirmante(data: { id: number; nombre: string; cargo: string }) {
  await requireSuperadmin();
  const [row] = await db.update(catalogoFirmantes)
    .set({ nombre: data.nombre.trim().toUpperCase(), cargo: data.cargo.trim() })
    .where(eq(catalogoFirmantes.id, data.id))
    .returning();
  return { firmante: row };
}

export async function toggleFirmante(id: number, activo: boolean) {
  await requireSuperadmin();
  await db.update(catalogoFirmantes).set({ activo }).where(eq(catalogoFirmantes.id, id));
  return { ok: true };
}

export async function eliminarFirmante(id: number) {
  await requireSuperadmin();
  await db.delete(catalogoFirmantes).where(eq(catalogoFirmantes.id, id));
  return { ok: true };
}
