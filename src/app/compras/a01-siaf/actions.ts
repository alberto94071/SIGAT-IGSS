"use server";
import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoCompras } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function getNextSiafNumeroCompras(): Promise<number> {
  const year = new Date().getFullYear();
  const result = await db.execute(
    sql`SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM siaf_compras WHERE anio = ${year}`
  );
  return Number((result.rows[0] as any).next) || 1;
}

export async function crearSolicitud(data: {
  fecha: string;
  observaciones?: string | null;
  items: {
    catalogo_id: number;
    codigo_igss: number | null;
    codigo_ppr: string | null;
    nombre: string;
    subproducto: string;
    unidad_medida: string | null;
    cantidad_solicitada: number;
  }[];
}) {
  try {
    const session = await auth();
    const uid = session ? Number(session.user.id) : null;
    const year = new Date().getFullYear();
    const numero = await getNextSiafNumeroCompras();

    const [solicitud] = await db.insert(siafCompras).values({
      numero, anio: year, fecha: data.fecha, estado: "Borrador",
      observaciones: data.observaciones ?? null, creado_por: uid,
    }).returning();

    // Calcula cantidad_antes server-side (snapshot al momento de guardar)
    // Procesa en orden para manejar el caso de que el mismo insumo+subproducto
    // aparezca más de una vez en la misma solicitud.
    const runningTotals = new Map<string, number>();
    const itemValues = [];

    for (const item of data.items) {
      const key = `${item.codigo_igss}::${item.subproducto}`;

      let autorizado = 0;
      if (item.codigo_igss != null) {
        const [cat] = await db
          .select({ cantidad: catalogoCompras.cantidad })
          .from(catalogoCompras)
          .where(and(
            eq(catalogoCompras.codigo_igss, item.codigo_igss),
            eq(catalogoCompras.subproducto, item.subproducto),
          ))
          .limit(1);
        autorizado = cat?.cantidad ?? 0;
      }

      const res = await db.execute(
        sql`SELECT COALESCE(SUM(cantidad_solicitada), 0) AS total
            FROM siaf_compras_items
            WHERE codigo_igss = ${item.codigo_igss}
            AND subproducto = ${item.subproducto}`
      );
      const dbTotal    = Number((res.rows[0] as any).total) || 0;
      const batchTotal = runningTotals.get(key) ?? 0;
      const cantidad_antes = autorizado - dbTotal - batchTotal;

      runningTotals.set(key, batchTotal + item.cantidad_solicitada);

      itemValues.push({
        solicitud_id:        solicitud.id,
        catalogo_id:         item.catalogo_id,
        codigo_igss:         item.codigo_igss,
        codigo_ppr:          item.codigo_ppr,
        nombre:              item.nombre,
        subproducto:         item.subproducto,
        unidad_medida:       item.unidad_medida,
        cantidad_antes,
        cantidad_solicitada: item.cantidad_solicitada,
      });
    }

    const items = itemValues.length > 0
      ? await db.insert(siafComprasItems).values(itemValues).returning()
      : [];

    return { solicitud: { ...solicitud, items } };
  } catch (e: any) {
    return { error: "Error al crear la solicitud" };
  }
}

export async function actualizarEstado(id: number, estado: string) {
  try {
    await db.update(siafCompras).set({ estado }).where(eq(siafCompras.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al actualizar estado" };
  }
}

export async function eliminarSolicitud(id: number) {
  try {
    await db.delete(siafCompras).where(eq(siafCompras.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al eliminar" };
  }
}
