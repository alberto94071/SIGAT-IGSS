"use server";
import { db } from "@/lib/db";
import { baseDatosCentral, catalogoSubproductos, proveedores } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── Insumos ───────────────────────────────────────────────────────────────────
export async function getInsumos() {
  return db.select().from(baseDatosCentral).orderBy(baseDatosCentral.nombre);
}

export async function crearInsumo(data: {
  codigo_igss?: number | null;
  codigo_ppr?: number | null;
  nombre: string;
  caracteristicas?: string | null;
  presentacion?: string | null;
  renglon?: number | null;
}) {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  const [row] = await db.insert(baseDatosCentral).values({ ...data, activo: true }).returning();
  revalidatePath("/base-datos/insumos");
  return { registro: row };
}

export async function editarInsumo(id: number, data: {
  codigo_igss?: number | null;
  codigo_ppr?: number | null;
  nombre: string;
  caracteristicas?: string | null;
  presentacion?: string | null;
  renglon?: number | null;
}) {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  await db.update(baseDatosCentral)
    .set({ ...data, updated_at: sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')` })
    .where(eq(baseDatosCentral.id, id));
  revalidatePath("/base-datos/insumos");
  return { ok: true };
}

export async function eliminarInsumo(id: number) {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  await db.delete(baseDatosCentral).where(eq(baseDatosCentral.id, id));
  revalidatePath("/base-datos/insumos");
  return { ok: true };
}

// ── Subproductos ──────────────────────────────────────────────────────────────
export async function getSubproductos() {
  return db.select().from(catalogoSubproductos).orderBy(catalogoSubproductos.nombre);
}

export async function crearSubproducto(nombre: string) {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  try {
    const [row] = await db.insert(catalogoSubproductos).values({ nombre, activo: true }).returning();
    revalidatePath("/base-datos/subproductos");
    return { subproducto: row };
  } catch {
    return { error: "Ya existe un subproducto con ese nombre" };
  }
}

export async function editarSubproducto(id: number, nombre: string) {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  try {
    await db.update(catalogoSubproductos).set({ nombre }).where(eq(catalogoSubproductos.id, id));
    revalidatePath("/base-datos/subproductos");
    return { ok: true };
  } catch {
    return { error: "Ya existe un subproducto con ese nombre" };
  }
}

export async function toggleSubproducto(id: number, activo: boolean) {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  await db.update(catalogoSubproductos).set({ activo }).where(eq(catalogoSubproductos.id, id));
  revalidatePath("/base-datos/subproductos");
  return { ok: true };
}

// ── Proveedores ───────────────────────────────────────────────────────────────
export async function getProveedores() {
  return db.select().from(proveedores).orderBy(proveedores.nombre);
}

export async function crearProveedor(data: {
  nit?: string | null;
  nombre: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
}) {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  const [row] = await db.insert(proveedores).values({ ...data, activo: true }).returning();
  revalidatePath("/base-datos/proveedores");
  return { proveedor: row };
}

export async function editarProveedor(id: number, data: {
  nit?: string | null;
  nombre: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
}) {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  await db.update(proveedores)
    .set({ ...data, updated_at: sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')` })
    .where(eq(proveedores.id, id));
  revalidatePath("/base-datos/proveedores");
  return { ok: true };
}

export async function toggleProveedor(id: number, activo: boolean) {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  await db.update(proveedores).set({ activo }).where(eq(proveedores.id, id));
  revalidatePath("/base-datos/proveedores");
  return { ok: true };
}
