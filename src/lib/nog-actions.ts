"use server";
import { db } from "@/lib/db";
import { nogRegistros, catalogoCompras } from "@/lib/schema";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function listarNogs() {
  return db.select().from(nogRegistros).orderBy(sql`created_at DESC`);
}

export async function buscarInsumosParaNog(q: string) {
  const session = await auth();
  if (!session) return [];
  if (!q || q.trim().length < 2) return [];
  return db.select({
    id:           catalogoCompras.id,
    nombre:       catalogoCompras.nombre,
    codigo_igss:  catalogoCompras.codigo_igss,
    subproducto:  catalogoCompras.subproducto,
  }).from(catalogoCompras).where(
    and(
      eq(catalogoCompras.activo, true),
      or(
        ilike(catalogoCompras.nombre, `%${q}%`),
        sql`${catalogoCompras.codigo_igss} ILIKE ${'%' + q + '%'}`,
        ilike(catalogoCompras.subproducto, `%${q}%`),
      )
    )
  ).limit(8);
}

export async function crearNog(data: {
  nog: string;
  proveedor_id: number | null; proveedor_nit: string | null; proveedor_nombre: string;
  insumo_id: number | null; insumo_nombre: string; insumo_codigo_igss: string | null; subproducto: string | null;
  cantidad_autorizada: number; precio: number; exento_iva: boolean;
}): Promise<{ nog: typeof nogRegistros.$inferSelect } | { error: string }> {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };
    if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

    if (!data.nog.trim()) return { error: "El número de NOG es obligatorio" };
    if (!data.proveedor_nombre.trim()) return { error: "El proveedor es obligatorio" };
    if (!data.insumo_nombre.trim()) return { error: "El insumo es obligatorio" };
    if (!(data.cantidad_autorizada > 0)) return { error: "Ingresa una cantidad autorizada válida" };
    if (!(data.precio > 0)) return { error: "Ingresa un precio válido" };

    const bruto = data.cantidad_autorizada * data.precio;
    const total = data.exento_iva ? bruto : bruto * 0.88;

    const [row] = await db.insert(nogRegistros).values({
      nog: data.nog.trim(),
      proveedor_id: data.proveedor_id,
      proveedor_nit: data.proveedor_nit,
      proveedor_nombre: data.proveedor_nombre.trim(),
      insumo_id: data.insumo_id,
      insumo_nombre: data.insumo_nombre.trim(),
      insumo_codigo_igss: data.insumo_codigo_igss,
      subproducto: data.subproducto,
      cantidad_autorizada: data.cantidad_autorizada,
      precio: data.precio,
      exento_iva: data.exento_iva,
      total,
      creado_por: Number(session.user.id),
    }).returning();

    return { nog: row };
  } catch {
    return { error: "Error al registrar el NOG" };
  }
}

export async function eliminarNog(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };
    if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

    await db.delete(nogRegistros).where(eq(nogRegistros.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al eliminar el NOG" };
  }
}
