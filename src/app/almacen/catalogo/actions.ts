"use server";
import { db } from "@/lib/db";
import { almacenInsumos, almacenLotes } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

export type InsumoAlmacen = {
  id: number; codigo_igss: string | null; subproducto: string; nombre: string;
  descripcion_igss: string | null; renglon: number | null; unidad_medida: string | null;
  stock_minimo: number | null; dias_alerta_vencimiento: number | null;
  cantidad_ingresada_total: number; cantidad_disponible_total: number;
  proximo_vencimiento: string | null;
};

// Existencia agregada por insumo: suma de todos sus lotes (cantidad_
// ingresada histórica y cantidad_disponible actual), más la fecha de
// vencimiento más próxima entre los lotes que todavía tienen existencia
// (para las pestañas de alerta). `proximo_vencimiento` usa MIN lexicográfico
// sobre texto porque las fechas se guardan en formato ISO "AAAA-MM-DD" en
// toda la base — mismo criterio que el resto del sistema.
export async function getCatalogoAlmacen(): Promise<InsumoAlmacen[]> {
  const session = await auth();
  if (!session) return [];

  const rows = await db.select({
    id:                        almacenInsumos.id,
    codigo_igss:               almacenInsumos.codigo_igss,
    subproducto:               almacenInsumos.subproducto,
    nombre:                    almacenInsumos.nombre,
    descripcion_igss:          almacenInsumos.descripcion_igss,
    renglon:                   almacenInsumos.renglon,
    unidad_medida:             almacenInsumos.unidad_medida,
    stock_minimo:              almacenInsumos.stock_minimo,
    dias_alerta_vencimiento:   almacenInsumos.dias_alerta_vencimiento,
    cantidad_ingresada_total:  sql<number>`coalesce(sum(${almacenLotes.cantidad_ingresada}), 0)`,
    cantidad_disponible_total: sql<number>`coalesce(sum(${almacenLotes.cantidad_disponible}), 0)`,
    proximo_vencimiento:       sql<string | null>`min(${almacenLotes.fecha_vencimiento}) filter (where ${almacenLotes.cantidad_disponible} > 0)`,
  }).from(almacenInsumos)
    .leftJoin(almacenLotes, eq(almacenLotes.insumo_id, almacenInsumos.id))
    .groupBy(almacenInsumos.id)
    .orderBy(almacenInsumos.nombre);

  return rows;
}

export async function actualizarUmbralesInsumo(
  insumoId: number, stockMinimo: number | null, diasAlertaVencimiento: number | null
): Promise<{ ok: true } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

  await db.update(almacenInsumos)
    .set({ stock_minimo: stockMinimo, dias_alerta_vencimiento: diasAlertaVencimiento })
    .where(eq(almacenInsumos.id, insumoId));
  return { ok: true };
}
