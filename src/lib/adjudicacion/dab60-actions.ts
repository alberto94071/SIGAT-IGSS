"use server";
import { fechaHoraGuatemala } from "@/lib/date-utils";

import { db } from "@/lib/db";
import { ordenesCompra } from "@/lib/schema";
import { eq, sql, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { gruposRenglonDeConsolidacion } from "./renglon-utils";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export async function getOrdenesEnDab() {
  const ordenes = await db.select().from(ordenesCompra).where(eq(ordenesCompra.estado, "Pendiente DAB-60")).orderBy(sql`created_at ASC`);
  return Promise.all(ordenes.map(async o => ({
    ...o, renglones: await gruposRenglonDeConsolidacion(o.consolidacion_id),
  })));
}

// Órdenes con DAB-60 ya generado, esperando aprobación antes de poder pasar
// a Presupuesto/Devengado — bandeja propia dentro del mismo módulo Almacén,
// para poder corregir datos mal ingresados sin tener que devolver la orden
// hasta Compromiso.
export async function getOrdenesDab60PendienteAprobacion() {
  const ordenes = await db.select().from(ordenesCompra).where(eq(ordenesCompra.estado, "DAB-60 Pendiente Aprobación")).orderBy(sql`created_at ASC`);
  return Promise.all(ordenes.map(async o => ({
    ...o, renglones: await gruposRenglonDeConsolidacion(o.consolidacion_id),
  })));
}

// Órdenes que ya pasaron por Almacén/DAB-60 (sin importar en qué etapa vayan
// después) — para consulta histórica y reimpresión en Almacén/Archivo.
export async function getOrdenesArchivadasAlmacen() {
  const ordenes = await db.select().from(ordenesCompra)
    .where(isNotNull(ordenesCompra.dab60_generado_en))
    .orderBy(sql`dab60_generado_en DESC`);
  return Promise.all(ordenes.map(async o => ({
    ...o, renglones: await gruposRenglonDeConsolidacion(o.consolidacion_id),
  })));
}

export type Dab60Data = {
  no_recibo_almacen: string; serie_recibo_almacen: string; encargado_almacen: string;
  fecha_ingreso_producto: string; no_factura: string; serie_factura: string;
  fecha_emision: string; lote: string; fecha_vencimiento: string;
  marca: string; modelo: string; serie: string;
};

// Generar (o corregir) el DAB-60 es puramente administrativo/de bodega — no
// vuelve a tocar Compromiso ni Devengado (eso ya se movió al comprometer y
// se termina de mover al devengar). El No./Serie de Recibo de Almacén y el
// Encargado de Almacén son los únicos datos obligatorios; el resto de
// factura/lote/marca/etc. son opcionales. Se puede llamar tanto para
// generarlo por primera vez ("Pendiente DAB-60") como para corregirlo
// mientras sigue en la bandeja de aprobación ("DAB-60 Pendiente
// Aprobación") — en ambos casos deja la orden en esa bandeja, esperando
// aprobarDab60 antes de poder pasar a Devengado.
export async function generarDab60(ordenId: number, data: Dab60Data): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    if (!data.no_recibo_almacen.trim() || !data.serie_recibo_almacen.trim())
      return { error: "El No. y la Serie de Recibo de Almacén son obligatorios" };
    if (!data.encargado_almacen.trim())
      return { error: "El nombre del Encargado de Almacén es obligatorio" };

    const [orden] = await db.select({ estado: ordenesCompra.estado }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "Pendiente DAB-60" && orden.estado !== "DAB-60 Pendiente Aprobación")
      return { error: "Esta orden ya fue procesada en DAB-60" };

    await db.update(ordenesCompra).set({
      no_recibo_almacen:      data.no_recibo_almacen.trim(),
      serie_recibo_almacen:   data.serie_recibo_almacen.trim(),
      encargado_almacen:      data.encargado_almacen.trim(),
      fecha_ingreso_producto: data.fecha_ingreso_producto.trim() || null,
      no_factura:             data.no_factura.trim() || null,
      serie_factura:          data.serie_factura.trim() || null,
      fecha_emision:          data.fecha_emision.trim() || null,
      lote:                   data.lote.trim() || null,
      fecha_vencimiento:      data.fecha_vencimiento.trim() || null,
      marca:                  data.marca.trim() || null,
      modelo:                 data.modelo.trim() || null,
      serie:                  data.serie.trim() || null,
      dab60_generado_en:      fechaHoraGuatemala(),
      estado:                 "DAB-60 Pendiente Aprobación",
    }).where(eq(ordenesCompra.id, ordenId));

    return { ok: true };
  } catch {
    return { error: "Error al generar el DAB-60" };
  }
}

// Aprueba el DAB-60 — recién aquí la orden puede pasar a Presupuesto/
// Devengado. Mismo módulo Almacén, sin cambios de presupuesto (esos ya
// ocurrieron al comprometer).
export async function aprobarDab60(ordenId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    const [orden] = await db.select({ estado: ordenesCompra.estado }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "DAB-60 Pendiente Aprobación") return { error: "Esta orden no está pendiente de aprobación de DAB-60" };

    await db.update(ordenesCompra).set({ estado: "En Devengado" }).where(eq(ordenesCompra.id, ordenId));

    return { ok: true };
  } catch {
    return { error: "Error al aprobar el DAB-60" };
  }
}
