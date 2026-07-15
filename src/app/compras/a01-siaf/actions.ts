"use server";
import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoCompras, consolidaciones, presupuestoRenglones } from "@/lib/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { crearNotificacion } from "@/lib/notificaciones";

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
    codigo_igss: string | null;
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

// Al aprobar un SIAF: además de cambiar el estado, toma cada ítem, lo cruza
// con el catálogo (mismo código IGSS + subproducto) para obtener su renglón
// y precio estimado, multiplica cantidad × precio, y suma ese monto al
// Pre-Compromiso del renglón/subproducto correspondiente en Presupuesto
// General — para ir viendo un aproximado de cuánto se va comprometiendo por
// renglón. Solo se aplica la primera vez que la solicitud queda Aprobada,
// para no duplicar el monto si se rechaza y se vuelve a aprobar después.
export async function aprobarSolicitud(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const [sol] = await db.select({ id: siafCompras.id, presupuesto_aplicado: siafCompras.presupuesto_aplicado })
      .from(siafCompras).where(eq(siafCompras.id, id)).limit(1);
    if (!sol) return { error: "Solicitud no encontrada" };

    if (!sol.presupuesto_aplicado) {
      const items = await db.select({
        codigo_igss:         siafComprasItems.codigo_igss,
        subproducto:         siafComprasItems.subproducto,
        cantidad_solicitada: siafComprasItems.cantidad_solicitada,
      }).from(siafComprasItems).where(eq(siafComprasItems.solicitud_id, id));

      const montosPorGrupo = new Map<string, { renglon: number; subproducto: string; monto: number }>();
      for (const item of items) {
        const queryCond = item.catalogo_id 
          ? eq(catalogoCompras.id, item.catalogo_id)
          : (item.codigo_igss != null
              ? and(eq(catalogoCompras.codigo_igss, item.codigo_igss), eq(catalogoCompras.subproducto, item.subproducto))
              : eq(catalogoCompras.nombre, item.nombre));

        const [cat] = await db.select({ renglon: catalogoCompras.renglon, precio_estimado: catalogoCompras.precio_estimado })
          .from(catalogoCompras)
          .where(queryCond)
          .limit(1);
        if (!cat || cat.renglon == null || cat.precio_estimado == null) continue;

        const monto = item.cantidad_solicitada * cat.precio_estimado;
        const key = `${cat.renglon}::${item.subproducto}::${item.nombre}`;
        const existente = montosPorGrupo.get(key);
        if (existente) existente.monto += monto;
        else montosPorGrupo.set(key, { renglon: cat.renglon, subproducto: item.subproducto, monto });
      }

      for (const { renglon, subproducto, monto } of montosPorGrupo.values()) {
        await db.update(presupuestoRenglones)
          .set({ pre_compromiso: sql`COALESCE(${presupuestoRenglones.pre_compromiso}, 0) + ${monto}` })
          .where(and(
            eq(presupuestoRenglones.renglon, renglon),
            eq(presupuestoRenglones.subproducto, subproducto),
            eq(presupuestoRenglones.ejercicio_fiscal, 2026),
          ));
      }
    }

    await db.update(siafCompras).set({ estado: "Aprobado", presupuesto_aplicado: true }).where(eq(siafCompras.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al aprobar la solicitud" };
  }
}

export async function rechazarSolicitud(id: number, motivo: string) {
  try {
    const trimmed = motivo.trim();
    if (!trimmed) return { error: "Debes indicar el motivo del rechazo" };

    const [sol] = await db.select().from(siafCompras).where(eq(siafCompras.id, id)).limit(1);
    if (!sol) return { error: "Solicitud no encontrada" };

    const session = await auth();
    const uid = session ? Number(session.user.id) : null;
    const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");

    await db.update(siafCompras).set({
      estado:         "Rechazado",
      motivo_rechazo: trimmed,
      rechazado_por:  uid,
      rechazado_en:   ahora,
    }).where(eq(siafCompras.id, id));

    if (sol.creado_por) {
      await crearNotificacion({
        usuario_id:      sol.creado_por,
        tipo:            "siaf_rechazado",
        titulo:          `SIAF ${sol.numero}/${sol.anio} rechazado`,
        mensaje:         trimmed,
        ruta:            `/compras/a01-siaf?ver=${id}`,
        referencia_tipo: "siaf_compras",
        referencia_id:   id,
      });
    }

    return { ok: true };
  } catch {
    return { error: "Error al rechazar la solicitud" };
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

export async function editarSolicitud(id: number, data: {
  fecha: string;
  observaciones?: string | null;
  items: {
    catalogo_id: number;
    codigo_igss: string | null;
    codigo_ppr: string | null;
    nombre: string;
    subproducto: string;
    unidad_medida: string | null;
    cantidad_solicitada: number;
  }[];
}) {
  try {
    // Primero eliminar los ítems existentes para que no afecten el recálculo
    await db.delete(siafComprasItems).where(eq(siafComprasItems.solicitud_id, id));

    // Actualizar cabecera
    await db.update(siafCompras).set({
      fecha:         data.fecha,
      observaciones: data.observaciones ?? null,
    }).where(eq(siafCompras.id, id));

    // Reinsertar ítems con cantidad_antes recalculada
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
          )).limit(1);
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
        solicitud_id:        id,
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

    const [solicitud] = await db.select().from(siafCompras).where(eq(siafCompras.id, id)).limit(1);
    return { solicitud: { ...solicitud, items } };
  } catch {
    return { error: "Error al editar la solicitud" };
  }
}

export async function consolidarSiaf(ids: number[], preOrden: string) {
  try {
    const pre = preOrden.trim();
    if (!/^[A-Za-z0-9]+$/.test(pre)) {
      return { error: "El Número de Pre Orden solo puede contener letras y números" };
    }

    const session = await auth();
    const uid = session ? Number(session.user.id) : null;
    const year = new Date().getFullYear();

    const rows = await db.select({ id: siafCompras.id, estado: siafCompras.estado })
      .from(siafCompras).where(inArray(siafCompras.id, ids));

    if (rows.length === 0) return { error: "No se encontraron las solicitudes" };
    if (rows.some(r => r.estado !== "Aprobado"))
      return { error: "Solo se pueden consolidar solicitudes con estado Aprobado" };

    const [existente] = await db.select({ id: consolidaciones.id })
      .from(consolidaciones).where(eq(consolidaciones.pre_orden, pre)).limit(1);
    if (existente) return { error: `Ya existe una consolidación con el Pre Orden ${pre}` };

    const res = await db.execute(
      sql`SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM consolidaciones WHERE anio = ${year}`
    );
    const numero = Number((res.rows[0] as any).next) || 1;
    const fecha = new Date().toISOString().slice(0, 10);

    const [consolidacion] = await db.insert(consolidaciones)
      .values({ numero, anio: year, fecha, pre_orden: pre, creado_por: uid })
      .returning();

    await db.update(siafCompras)
      .set({ estado: "Consolidado", consolidacion_id: consolidacion.id })
      .where(inArray(siafCompras.id, ids));

    return { consolidacion };
  } catch {
    return { error: "Error al consolidar las solicitudes" };
  }
}

