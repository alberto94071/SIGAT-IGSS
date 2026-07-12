"use server";
import { db } from "@/lib/db";
import { consolidaciones, ordenesCompra, siafCompras } from "@/lib/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { gruposRenglonDeConsolidacion } from "./renglon-utils";

async function requireCompras(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export type ConsolidacionPendienteOrden = {
  id: number; numero: number; anio: number; fecha: string;
  tipo_compra: string | null; nog: string | null; referencia: string | null;
  proveedor_nit: string | null; proveedor_nombre: string | null; total: number | null;
  pre_orden: string | null; numero_adjudicacion: string | null;
  renglones: { renglon: number | null; subproducto: string; nombre: string; cantidad: number }[];
};

export async function getConsolidacionesPendientesOrden(): Promise<ConsolidacionPendienteOrden[]> {
  const cons = await db.select().from(consolidaciones)
    .where(and(eq(consolidaciones.estado, "Enviado a Presupuesto"), eq(consolidaciones.destino, "presupuesto")))
    .orderBy(sql`created_at ASC`);

  return Promise.all(cons.map(async c => ({
    id: c.id, numero: c.numero, anio: c.anio, fecha: c.fecha,
    tipo_compra: c.tipo_compra, nog: c.nog, referencia: c.referencia,
    proveedor_nit: c.proveedor_nit, proveedor_nombre: c.proveedor_nombre, total: c.total,
    pre_orden: c.pre_orden, numero_adjudicacion: c.numero_adjudicacion,
    renglones: await gruposRenglonDeConsolidacion(c.id),
  })));
}

export async function getOrdenesEnProceso() {
  const ordenes = await db.select().from(ordenesCompra).where(eq(ordenesCompra.estado, "Generada")).orderBy(sql`created_at ASC`);
  return Promise.all(ordenes.map(async o => ({
    ...o, renglones: await gruposRenglonDeConsolidacion(o.consolidacion_id),
  })));
}

// El precio unitario ya no se teclea: se deriva del total ya adjudicado
// (cruzado con las cotizaciones) entre la cantidad total, para no pedirle al
// usuario un dato que el sistema ya conoce.
export async function generarOrdenDeCompra(consolidacionId: number, data: {
  codigo_ppr: string; numero_orden: string; fecha_notificacion: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    if (!data.codigo_ppr.trim()) return { error: "El Código PPR es obligatorio" };
    const numero = parseInt(data.numero_orden.trim(), 10);
    if (!data.numero_orden.trim() || Number.isNaN(numero)) return { error: "El número de orden de compra es inválido" };
    if (!data.fecha_notificacion) return { error: "La fecha de notificación al proveedor es obligatoria" };

    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.estado !== "Enviado a Presupuesto") return { error: "La consolidación no está lista para generar la orden" };

    const year = new Date().getFullYear();
    const fecha = new Date().toISOString().slice(0, 10);

    const renglones = await gruposRenglonDeConsolidacion(consolidacionId);
    const total_cantidad = renglones.reduce((s, r) => s + r.cantidad, 0);
    if (total_cantidad === 0 || con.total == null) return { error: "No se pudo calcular el precio unitario: faltan cantidad o total adjudicados" };
    const costoUnitario = con.total / total_cantidad;

    await db.insert(ordenesCompra).values({
      numero, anio: year, fecha,
      consolidacion_id: consolidacionId,
      tipo_compra:      con.tipo_compra!,
      nog:              con.nog ?? null,
      referencia:       con.referencia ?? null,
      proveedor_id:     con.proveedor_id ?? null,
      proveedor_nit:    con.proveedor_nit ?? null,
      proveedor_nombre: con.proveedor_nombre ?? null,
      costo_unitario:   costoUnitario,
      total_cantidad,
      exento_iva:       con.exento_iva,
      total:            con.total ?? null,
      estado:           "Generada",
      codigo_ppr:                   data.codigo_ppr.trim(),
      fecha_notificacion_proveedor: data.fecha_notificacion,
      creado_por:       check.uid,
    });

    await db.update(consolidaciones)
      .set({ estado: "Orden de Compra Generada" })
      .where(eq(consolidaciones.id, consolidacionId));

    await db.update(siafCompras)
      .set({ estado: "Orden de Compra" })
      .where(eq(siafCompras.consolidacion_id, consolidacionId));

    return { ok: true };
  } catch {
    return { error: "Error al generar la orden de compra" };
  }
}

export async function enviarOrdenAPresupuesto(ordenId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [orden] = await db.select({ estado: ordenesCompra.estado }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "Generada") return { error: "Esta orden ya fue enviada a Presupuesto" };

    await db.update(ordenesCompra).set({ estado: "En Compromiso" }).where(eq(ordenesCompra.id, ordenId));
    return { ok: true };
  } catch {
    return { error: "Error al enviar la orden a Presupuesto" };
  }
}
