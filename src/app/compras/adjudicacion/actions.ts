"use server";
import { db } from "@/lib/db";
import {
  consolidaciones, siafCompras, siafComprasItems,
  ordenesCompra, proveedores,
} from "@/lib/schema";
import { eq, sql, inArray, ilike, or, and, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";

// ─── Lectura ──────────────────────────────────────────────────────────────────

export async function getConsolidacionesConDetalles() {
  const cons = await db.select().from(consolidaciones)
    .orderBy(sql`anio DESC, numero DESC`);

  const siaf = await db.select({
    id:               siafCompras.id,
    numero:           siafCompras.numero,
    anio:             siafCompras.anio,
    fecha:            siafCompras.fecha,
    estado:           siafCompras.estado,
    consolidacion_id: siafCompras.consolidacion_id,
  }).from(siafCompras).where(isNotNull(siafCompras.consolidacion_id));

  const siafIds = siaf.map(s => s.id);
  let items: { solicitud_id: number; cantidad_solicitada: number }[] = [];
  if (siafIds.length > 0) {
    items = await db.select({
      solicitud_id:        siafComprasItems.solicitud_id,
      cantidad_solicitada: siafComprasItems.cantidad_solicitada,
    }).from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds));
  }

  return cons.map(c => {
    const cSiaf = siaf.filter(s => s.consolidacion_id === c.id);
    const cSiafIds = new Set(cSiaf.map(s => s.id));
    const cItems = items.filter(i => cSiafIds.has(i.solicitud_id));
    const total_cantidad = cItems.reduce((sum, i) => sum + (i.cantidad_solicitada ?? 0), 0);
    return { ...c, siaf: cSiaf, total_cantidad };
  });
}

export async function getOrdenes() {
  return db.select().from(ordenesCompra).orderBy(sql`anio DESC, numero DESC`);
}

export async function buscarProveedoresAuto(q: string) {
  if (!q || q.trim().length < 2) return [];
  return db.select({
    id:       proveedores.id,
    nit:      proveedores.nit,
    nombre:   proveedores.nombre,
    telefono: proveedores.telefono,
  }).from(proveedores).where(
    and(
      eq(proveedores.activo, true),
      or(
        ilike(proveedores.nombre, `%${q}%`),
        sql`${proveedores.nit} ILIKE ${'%' + q + '%'}`,
      )
    )
  ).limit(8);
}

// ─── Adjudicación: Compra Directa Fase 1 ─────────────────────────────────────

export async function adjudicarFase1(id: number, nog: string, fechaEvento: string) {
  try {
    await db.update(consolidaciones).set({
      tipo_compra:  "Compra Directa",
      estado:       "Adjudicado",
      nog,
      fecha_evento: fechaEvento,
    }).where(eq(consolidaciones.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al registrar la adjudicación" };
  }
}

// ─── Anular Consolidación ─────────────────────────────────────────────────────

export async function anularConsolidacion(id: number) {
  try {
    await db.update(siafCompras)
      .set({ estado: "Borrador", consolidacion_id: null })
      .where(eq(siafCompras.consolidacion_id, id));
    await db.delete(consolidaciones).where(eq(consolidaciones.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al anular la consolidación" };
  }
}

// ─── Generar Orden de Compra (Baja Cuantía / Contrato / Excepción) ──────────

export async function generarOrdenCompra(id: number, data: {
  tipo_compra:     "Baja Cuantía" | "Contrato Abierto" | "Casos de Excepción";
  referencia:      string;
  costo_unitario:  number;
  exento_iva:      boolean;
  total:           number;
  total_cantidad:  number;
  proveedor_id:    number | null;
  proveedor_nit:   string;
  proveedor_nombre: string;
}) {
  try {
    const session = await auth();
    const uid = session ? Number(session.user.id) : null;
    const year = new Date().getFullYear();
    const fecha = new Date().toISOString().slice(0, 10);

    const res = await db.execute(
      sql`SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM ordenes_compra WHERE anio = ${year}`
    );
    const numero = Number((res.rows[0] as any).next) || 1;

    const [orden] = await db.insert(ordenesCompra).values({
      numero, anio: year, fecha,
      consolidacion_id: id,
      tipo_compra:      data.tipo_compra,
      referencia:       data.referencia,
      proveedor_id:     data.proveedor_id,
      proveedor_nit:    data.proveedor_nit,
      proveedor_nombre: data.proveedor_nombre,
      costo_unitario:   data.costo_unitario,
      total_cantidad:   data.total_cantidad,
      exento_iva:       data.exento_iva,
      total:            data.total,
      estado:           "Activa",
      creado_por:       uid,
    }).returning();

    await db.update(consolidaciones).set({
      tipo_compra:      data.tipo_compra,
      estado:           "Orden de Compra Generada",
      referencia:       data.referencia,
      costo_unitario:   data.costo_unitario,
      exento_iva:       data.exento_iva,
      total:            data.total,
      proveedor_id:     data.proveedor_id,
      proveedor_nit:    data.proveedor_nit,
      proveedor_nombre: data.proveedor_nombre,
    }).where(eq(consolidaciones.id, id));

    await db.update(siafCompras)
      .set({ estado: "Orden de Compra" })
      .where(eq(siafCompras.consolidacion_id, id));

    return { orden };
  } catch {
    return { error: "Error al generar la orden de compra" };
  }
}

// ─── Completar Orden: Compra Directa Fase 2 ──────────────────────────────────

export async function completarOrdenDirecta(id: number, data: {
  costo_unitario:  number;
  exento_iva:      boolean;
  total:           number;
  total_cantidad:  number;
  proveedor_id:    number | null;
  proveedor_nit:   string;
  proveedor_nombre: string;
}) {
  try {
    const session = await auth();
    const uid = session ? Number(session.user.id) : null;
    const year = new Date().getFullYear();
    const fecha = new Date().toISOString().slice(0, 10);

    const [con] = await db.select({ nog: consolidaciones.nog })
      .from(consolidaciones).where(eq(consolidaciones.id, id)).limit(1);

    const res = await db.execute(
      sql`SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM ordenes_compra WHERE anio = ${year}`
    );
    const numero = Number((res.rows[0] as any).next) || 1;

    const [orden] = await db.insert(ordenesCompra).values({
      numero, anio: year, fecha,
      consolidacion_id: id,
      tipo_compra:      "Compra Directa",
      nog:              con?.nog ?? null,
      proveedor_id:     data.proveedor_id,
      proveedor_nit:    data.proveedor_nit,
      proveedor_nombre: data.proveedor_nombre,
      costo_unitario:   data.costo_unitario,
      total_cantidad:   data.total_cantidad,
      exento_iva:       data.exento_iva,
      total:            data.total,
      estado:           "Activa",
      creado_por:       uid,
    }).returning();

    await db.update(consolidaciones).set({
      estado:           "Orden de Compra Generada",
      costo_unitario:   data.costo_unitario,
      exento_iva:       data.exento_iva,
      total:            data.total,
      proveedor_id:     data.proveedor_id,
      proveedor_nit:    data.proveedor_nit,
      proveedor_nombre: data.proveedor_nombre,
    }).where(eq(consolidaciones.id, id));

    await db.update(siafCompras)
      .set({ estado: "Orden de Compra" })
      .where(eq(siafCompras.consolidacion_id, id));

    return { orden };
  } catch {
    return { error: "Error al generar la orden de compra" };
  }
}
