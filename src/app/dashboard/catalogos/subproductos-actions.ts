"use server";
import { db } from "@/lib/db";
import { catalogoSubproductos } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

async function checkSuperadmin() {
  const s = await auth();
  if (s?.user.rol !== "superadmin") throw new Error("Solo superadmin");
}

export async function crearSubproducto(nombre: string) {
  try {
    await checkSuperadmin();
    const [row] = await db.insert(catalogoSubproductos).values({ nombre: nombre.trim() }).returning();
    return { subproducto: row };
  } catch (e: any) {
    if (e.message?.includes("unique")) return { error: "Ya existe ese subproducto" };
    if (e.message?.includes("superadmin")) return { error: "Sin permiso" };
    return { error: "Error al crear" };
  }
}

export async function editarSubproducto(id: number, nombre: string) {
  try {
    await checkSuperadmin();
    await db.update(catalogoSubproductos).set({ nombre: nombre.trim() }).where(eq(catalogoSubproductos.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al editar" };
  }
}

export async function toggleSubproducto(id: number, activo: boolean) {
  try {
    await checkSuperadmin();
    await db.update(catalogoSubproductos).set({ activo }).where(eq(catalogoSubproductos.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al cambiar estado" };
  }
}
