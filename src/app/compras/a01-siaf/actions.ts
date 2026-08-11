"use server";
import { fechaGuatemala, fechaHoraGuatemala } from "@/lib/date-utils";

import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoCompras, consolidaciones, presupuestoRenglones, cotizacionesAnuales, cotizacionesAnualesItems } from "@/lib/schema";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { crearNotificacion } from "@/lib/notificaciones";
import { verificarPresupuestoDisponible, mensajePresupuestoExcedido } from "@/lib/presupuesto-disponible";

// Todo ítem de un SIAF debe existir en el PAC (Catálogo de Compras) — si el
// catalogo_id que mandó el cliente ya no existe o fue desactivado, no se
// puede ni crear ni editar la solicitud con ese ítem.
async function validarItemsEnPac(items: { catalogo_id: number }[]): Promise<string | null> {
  const ids = [...new Set(items.map(i => i.catalogo_id))];
  if (ids.length === 0) return null;
  const rows = await db.select({ id: catalogoCompras.id, activo: catalogoCompras.activo })
    .from(catalogoCompras).where(inArray(catalogoCompras.id, ids));
  const encontrados = new Map(rows.map(r => [r.id, r.activo]));
  const faltantes = ids.filter(id => !encontrados.has(id));
  const inactivos = ids.filter(id => encontrados.get(id) === false);
  if (faltantes.length > 0 || inactivos.length > 0) {
    return "Uno o más insumos ya no existen en el PAC (Catálogo de Compras) o fueron desactivados. Verifica el catálogo antes de continuar.";
  }
  return null;
}

type ItemPacExcedido = { nombre: string; disponible: number; requerido: number };

// Cantidad todavía disponible en el PAC para un insumo (código IGSS +
// subproducto) del año dado: la cantidad autorizada en el catálogo, menos lo
// que ya está pedido en otros SIAF del mismo año que no estén Rechazados
// (Borrador o Aprobado — un Borrador también aparta cantidad, para que dos
// solicitudes en trámite a la vez no se pisen entre sí). Excluye la propia
// solicitud que se está aprobando, para no restarse a sí misma dos veces.
async function verificarPacDisponible(
  items: { codigo_igss: string | null; subproducto: string; nombre: string; cantidad_solicitada: number }[],
  anio: number, solicitudIdActual: number,
): Promise<ItemPacExcedido[]> {
  const porClave = new Map<string, { codigo_igss: string; subproducto: string; nombre: string; monto: number }>();
  for (const item of items) {
    if (!item.codigo_igss) continue; // sin código IGSS no hay con qué cruzar la cantidad del PAC
    const key = `${item.codigo_igss}::${item.subproducto}`;
    const existente = porClave.get(key);
    if (existente) existente.monto += item.cantidad_solicitada;
    else porClave.set(key, { codigo_igss: item.codigo_igss, subproducto: item.subproducto, nombre: item.nombre, monto: item.cantidad_solicitada });
  }

  const excedidos: ItemPacExcedido[] = [];
  for (const { codigo_igss, subproducto, nombre, monto } of porClave.values()) {
    const [cat] = await db.select({ cantidad: catalogoCompras.cantidad }).from(catalogoCompras)
      .where(and(eq(catalogoCompras.codigo_igss, codigo_igss), eq(catalogoCompras.subproducto, subproducto))).limit(1);
    // Sin cantidad configurada en el PAC para este insumo no hay límite que
    // verificar (no es lo mismo que "cero disponible") — se deja pasar.
    if (cat?.cantidad == null) continue;
    const autorizado = cat.cantidad;

    const res = await db.execute(sql`
      SELECT COALESCE(SUM(sci.cantidad_solicitada), 0) AS total
      FROM siaf_compras_items sci
      JOIN siaf_compras sc ON sc.id = sci.solicitud_id
      WHERE sci.codigo_igss = ${codigo_igss} AND sci.subproducto = ${subproducto}
        AND sc.anio = ${anio} AND sc.estado != 'Rechazado' AND sc.id != ${solicitudIdActual}
    `);
    const yaReservado = Number((res.rows[0] as any).total) || 0;
    const disponible = autorizado - yaReservado;
    if (monto > disponible + 0.01) excedidos.push({ nombre, disponible, requerido: monto });
  }
  return excedidos;
}

function mensajePacExcedido(excedidos: ItemPacExcedido[]): string {
  const detalle = excedidos.map(e =>
    `${e.nombre} (disponible en el PAC: ${e.disponible.toLocaleString("es-GT")}, se necesitan: ${e.requerido.toLocaleString("es-GT")})`
  ).join("; ");
  return `No hay cantidad disponible en el PAC (Catálogo de Compras) para: ${detalle}. Amplía la cantidad autorizada en el catálogo antes de aprobar.`;
}

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
    const errPac = await validarItemsEnPac(data.items);
    if (errPac) return { error: errPac };

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
// con el catálogo (mismo código IGSS + subproducto) para obtener su renglón,
// y calcula el precio unitario: si existe una cotización anual vigente para
// ese código IGSS (precio pactado con el proveedor para todo el año), usa
// ese precio (neto de IVA por línea, igual que en Adjudicación); si no hay
// cotización anual, cae al precio estimado del catálogo. Multiplica
// cantidad × precio y suma ese monto al Pre-Compromiso del renglón/
// subproducto correspondiente en Presupuesto General — para ir viendo un
// aproximado de cuánto se va comprometiendo por renglón. Solo se aplica la
// primera vez que la solicitud queda Aprobada, para no duplicar el monto si
// se rechaza y se vuelve a aprobar después.
export async function aprobarSolicitud(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const [sol] = await db.select({ id: siafCompras.id, anio: siafCompras.anio, presupuesto_aplicado: siafCompras.presupuesto_aplicado })
      .from(siafCompras).where(eq(siafCompras.id, id)).limit(1);
    if (!sol) return { error: "Solicitud no encontrada" };

    if (!sol.presupuesto_aplicado) {
      const items = await db.select({
        catalogo_id:         siafComprasItems.catalogo_id,
        nombre:              siafComprasItems.nombre,
        codigo_igss:         siafComprasItems.codigo_igss,
        subproducto:         siafComprasItems.subproducto,
        cantidad_solicitada: siafComprasItems.cantidad_solicitada,
      }).from(siafComprasItems).where(eq(siafComprasItems.solicitud_id, id));

      const excedidosPac = await verificarPacDisponible(items, sol.anio, id);
      if (excedidosPac.length > 0) {
        return { error: mensajePacExcedido(excedidosPac) };
      }

      const montosPorGrupo = new Map<string, { renglon: number; subproducto: string; monto: number }>();
      const sinCatalogo: string[] = [];
      const sinPrecio: string[] = [];
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
        // No puede aprobarse (ni reservar presupuesto) un ítem que ya no
        // existe en el PAC o que no tiene renglón asignado ahí.
        if (!cat || cat.renglon == null) { sinCatalogo.push(item.nombre); continue; }

        let precioUnitario = cat.precio_estimado;
        if (item.codigo_igss != null) {
          const [cotiz] = await db.select({
            precio_unitario: cotizacionesAnualesItems.precio_unitario,
            exento_iva:      cotizacionesAnualesItems.exento_iva,
          })
            .from(cotizacionesAnualesItems)
            .innerJoin(cotizacionesAnuales, eq(cotizacionesAnualesItems.cotizacion_anual_id, cotizacionesAnuales.id))
            .where(and(
              eq(cotizacionesAnualesItems.codigo_igss, item.codigo_igss),
              eq(cotizacionesAnuales.anio, 2026),
            ))
            .orderBy(desc(cotizacionesAnualesItems.id))
            .limit(1);
          if (cotiz) {
            precioUnitario = cotiz.exento_iva ? cotiz.precio_unitario : cotiz.precio_unitario * 0.88;
          }
        }
        // Sin precio no se puede calcular el monto a reservar contra
        // presupuesto — tampoco se puede dejar pasar en silencio.
        if (precioUnitario == null) { sinPrecio.push(item.nombre); continue; }

        const monto = item.cantidad_solicitada * precioUnitario;
        const key = `${cat.renglon}::${item.subproducto}::${item.nombre}`;
        const existente = montosPorGrupo.get(key);
        if (existente) existente.monto += monto;
        else montosPorGrupo.set(key, { renglon: cat.renglon, subproducto: item.subproducto, monto });
      }

      if (sinCatalogo.length > 0) {
        return { error: `Estos insumos ya no existen en el PAC (Catálogo de Compras): ${sinCatalogo.join(", ")}. Corrígelos antes de aprobar.` };
      }
      if (sinPrecio.length > 0) {
        return { error: `Estos insumos no tienen precio estimado en el PAC, no se puede calcular cuánto reservar de presupuesto: ${sinPrecio.join(", ")}.` };
      }

      const excedidos = await verificarPresupuestoDisponible(
        Array.from(montosPorGrupo.values()).map(g => ({ renglon: g.renglon, subproducto: g.subproducto, monto: g.monto }))
      );
      if (excedidos.length > 0) {
        return { error: await mensajePresupuestoExcedido(excedidos) };
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
    const ahora = fechaHoraGuatemala();

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
    const errPac = await validarItemsEnPac(data.items);
    if (errPac) return { error: errPac };

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
    const fecha = fechaGuatemala();

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

