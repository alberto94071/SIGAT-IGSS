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
  fecha_ingreso_producto: string; no_factura: string; serie_factura: string;
  fecha_emision: string; lote: string; fecha_vencimiento: string;
  marca: string; modelo: string; serie: string;
};

// Generar el DAB-60 es puramente administrativo/de bodega — no vuelve a
// tocar Compromiso ni Devengado (eso ya se movió al comprometer y se termina
// de mover al devengar). Los datos de factura/lote/marca/etc. son opcionales:
// se guardan si se capturan, pero no bloquean el ingreso a Almacén.
export async function generarDab60(ordenId: number, data: Dab60Data): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    const [orden] = await db.select({ estado: ordenesCompra.estado }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "Pendiente DAB-60") return { error: "Esta orden ya fue procesada en DAB-60" };

    await db.update(ordenesCompra).set({
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
      estado:                 "En Devengado",
    }).where(eq(ordenesCompra.id, ordenId));

    return { ok: true };
  } catch {
    return { error: "Error al generar el DAB-60" };
  }
}
