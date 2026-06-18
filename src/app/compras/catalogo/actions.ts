"use server";
import { db } from "@/lib/db";
import { catalogoCompras, catalogo182 } from "@/lib/schema";
import { eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

async function checkAuth() {
  const s = await auth();
  if (!s) throw new Error("Sin sesión");
  return s;
}

// Busca en el catálogo general 182 (referencia IGSS)
export async function buscarCatalogoGeneral(q: string) {
  if (!q || q.trim().length < 2) return [];
  try {
    const results = await db
      .select({
        codigo_igss:     catalogo182.codigo_igss,
        codigo_ppr:      catalogo182.codigo_ppr,
        nombre:          catalogo182.insumo,
        caracteristicas: catalogo182.caracteristicas,
        presentacion:    catalogo182.presentacion,
        unidad_medida:   catalogo182.unidad_medida,
      })
      .from(catalogo182)
      .where(
        or(
          ilike(catalogo182.insumo, `%${q}%`),
          ilike(catalogo182.codigo_ppr, `%${q}%`),
          sql`${catalogo182.codigo_igss}::text ILIKE ${'%' + q + '%'}`,
        )
      )
      .limit(10);
    return results;
  } catch {
    return [];
  }
}

export async function crearInsumoCompras(data: any) {
  try {
    await checkAuth();
    const [row] = await db.insert(catalogoCompras).values({
      codigo_igss:     data.codigo_igss ? Number(data.codigo_igss) : null,
      codigo_ppr:      data.codigo_ppr || null,
      nombre:          data.nombre,
      caracteristicas: data.caracteristicas || null,
      presentacion:    data.presentacion || null,
      unidad_medida:   data.unidad_medida || null,
      subproducto:     data.subproducto,
      cantidad:        data.cantidad ? parseFloat(data.cantidad) : null,
      activo:          true,
    }).returning();
    return { insumo: row };
  } catch {
    return { error: "Error al crear el insumo" };
  }
}

export async function editarInsumoCompras(data: any) {
  try {
    await checkAuth();
    await db.update(catalogoCompras).set({
      codigo_igss:     data.codigo_igss ? Number(data.codigo_igss) : null,
      codigo_ppr:      data.codigo_ppr || null,
      nombre:          data.nombre,
      caracteristicas: data.caracteristicas || null,
      presentacion:    data.presentacion || null,
      unidad_medida:   data.unidad_medida || null,
      subproducto:     data.subproducto,
      cantidad:        data.cantidad ? parseFloat(data.cantidad) : null,
    }).where(eq(catalogoCompras.id, data.id));
    return { ok: true };
  } catch {
    return { error: "Error al editar" };
  }
}

export async function toggleInsumoCompras(id: number, activo: boolean) {
  try {
    await checkAuth();
    await db.update(catalogoCompras).set({ activo }).where(eq(catalogoCompras.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al cambiar estado" };
  }
}
