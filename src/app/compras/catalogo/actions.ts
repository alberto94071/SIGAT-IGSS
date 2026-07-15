"use server";
import { db } from "@/lib/db";
import { catalogoCompras, baseDatosCentral } from "@/lib/schema";
import { eq, or, ilike, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

async function checkAuth() {
  const s = await auth();
  if (!s) throw new Error("Sin sesión");
  return s;
}

// Busca en la Base de Datos Central
export async function buscarCatalogoGeneral(q: string) {
  if (!q || q.trim().length < 2) return [];
  try {
    const results = await db
      .select({
        codigo_igss:     baseDatosCentral.codigo_igss,
        codigo_ppr:      sql<string | null>`${baseDatosCentral.codigo_ppr}::text`,
        nombre:          baseDatosCentral.nombre,
        caracteristicas: baseDatosCentral.caracteristicas,
        presentacion:    baseDatosCentral.presentacion,
        unidad_medida:   sql<null>`null`,
      })
      .from(baseDatosCentral)
      .where(
        or(
          ilike(baseDatosCentral.nombre, `%${q}%`),
          ilike(baseDatosCentral.caracteristicas, `%${q}%`),
          sql`${baseDatosCentral.codigo_ppr}::text ILIKE ${'%' + q + '%'}`,
          sql`${baseDatosCentral.codigo_igss}::text ILIKE ${'%' + q + '%'}`,
          ilike(baseDatosCentral.codigo_rango, `%${q}%`),
        )
      )
      .limit(10);
    return results;
  } catch {
    return [];
  }
}

type InsumoComprasInput = {
  nombre: string;
  subproducto: string;
  cantidad: number;
  unidad_medida?: string | null;
  codigo_igss?: string | null;
  renglon?: number | null;
  codigo_nombre_ppr?: number | null;
  nombre_ppr?: string | null;
  codigo_presentacion_ppr?: number | null;
  precio_estimado?: number | null;
};

function toValues(data: InsumoComprasInput) {
  const precio = data.precio_estimado ?? null;
  return {
    nombre:                  data.nombre,
    subproducto:             data.subproducto,
    cantidad:                data.cantidad,
    unidad_medida:           data.unidad_medida || null,
    codigo_igss:             data.codigo_igss || null,
    renglon:                 data.renglon ?? null,
    codigo_nombre_ppr:       data.codigo_nombre_ppr ?? null,
    nombre_ppr:              data.nombre_ppr || null,
    codigo_presentacion_ppr: data.codigo_presentacion_ppr ?? null,
    precio_estimado:         precio,
    monto:                   precio != null ? precio * data.cantidad : null,
  };
}

export async function crearInsumoCompras(data: InsumoComprasInput): Promise<
  { insumo: typeof catalogoCompras.$inferSelect } | { error: string }
> {
  try {
    await checkAuth();
    if (!data.nombre.trim()) return { error: "El nombre es obligatorio" };
    if (!data.subproducto.trim()) return { error: "El subproducto es obligatorio" };
    if (!(data.cantidad > 0)) return { error: "Ingresa una cantidad válida" };

    const [row] = await db.insert(catalogoCompras).values({
      ...toValues(data),
      activo: true,
    }).returning();
    return { insumo: row };
  } catch {
    return { error: "Error al crear el insumo" };
  }
}

export async function editarInsumoCompras(id: number, data: InsumoComprasInput): Promise<{ ok: true } | { error: string }> {
  try {
    await checkAuth();
    if (!data.nombre.trim()) return { error: "El nombre es obligatorio" };
    if (!data.subproducto.trim()) return { error: "El subproducto es obligatorio" };
    if (!(data.cantidad > 0)) return { error: "Ingresa una cantidad válida" };

    await db.update(catalogoCompras).set(toValues(data)).where(eq(catalogoCompras.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al editar" };
  }
}

export async function toggleInsumoCompras(id: number, activo: boolean): Promise<{ ok: true } | { error: string }> {
  try {
    await checkAuth();
    await db.update(catalogoCompras).set({ activo }).where(eq(catalogoCompras.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al cambiar estado" };
  }
}
