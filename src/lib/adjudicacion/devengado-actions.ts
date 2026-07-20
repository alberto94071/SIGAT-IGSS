"use server";
import { db } from "@/lib/db";
import { ordenesCompra } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { gruposRenglonDeConsolidacion } from "./renglon-utils";
import { presupuestoRenglones } from "@/lib/schema";
import { and } from "drizzle-orm";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export async function getOrdenesEnDevengado() {
  const ordenes = await db.select().from(ordenesCompra).where(eq(ordenesCompra.estado, "En Devengado")).orderBy(sql`created_at ASC`);
  return Promise.all(ordenes.map(async o => ({
    ...o, renglones: await gruposRenglonDeConsolidacion(o.consolidacion_id),
  })));
}

export type DevengarData = {
  fecha_ingreso_producto: string; no_factura: string; serie_factura: string;
  fecha_emision: string; lote: string; fecha_vencimiento: string;
  marca: string; modelo: string; serie: string; no_devengado: string;
};

export async function devengarYEnviarADab(ordenId: number, data: DevengarData): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    for (const [campo, label] of [
      ["fecha_ingreso_producto", "Fecha de ingreso del producto"], ["no_factura", "No. Factura"],
      ["serie_factura", "Serie de factura"], ["fecha_emision", "Fecha de emisión"],
      ["lote", "Lote"], ["fecha_vencimiento", "Fecha de vencimiento"],
      ["marca", "Marca"], ["modelo", "Modelo"], ["serie", "Serie"], ["no_devengado", "No. Devengado"],
    ] as const) {
      if (!data[campo]?.trim()) return { error: `El campo "${label}" es obligatorio` };
    }

    const [orden] = await db.select({ 
      estado: ordenesCompra.estado,
      consolidacion_id: ordenesCompra.consolidacion_id
    }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "En Devengado") return { error: "Esta orden ya fue enviada a DAB" };

    await db.update(ordenesCompra).set({
      fecha_ingreso_producto: data.fecha_ingreso_producto,
      no_factura:             data.no_factura.trim(),
      serie_factura:          data.serie_factura.trim(),
      fecha_emision:          data.fecha_emision,
      lote:                   data.lote.trim(),
      fecha_vencimiento:      data.fecha_vencimiento,
      marca:                  data.marca.trim(),
      modelo:                 data.modelo.trim(),
      serie:                  data.serie.trim(),
      no_devengado:           data.no_devengado.trim(),
      estado:                 "En DAB",
    }).where(eq(ordenesCompra.id, ordenId));

    const renglones = await gruposRenglonDeConsolidacion(orden.consolidacion_id);
    for (const r of renglones) {
      await db.update(presupuestoRenglones).set({
        compromiso: sql`COALESCE(${presupuestoRenglones.compromiso}, 0) - ${r.total}`,
        devengado: sql`COALESCE(${presupuestoRenglones.devengado}, 0) + ${r.total}`,
      }).where(and(
        eq(presupuestoRenglones.renglon, r.renglon as number),
        eq(presupuestoRenglones.subproducto, r.subproducto),
        eq(presupuestoRenglones.ejercicio_fiscal, 2026)
      ));
    }

    return { ok: true };
  } catch {
    return { error: "Error al registrar el devengado" };
  }
}
