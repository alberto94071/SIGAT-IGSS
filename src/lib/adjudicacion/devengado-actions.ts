"use server";
import { db } from "@/lib/db";
import { ordenesCompra, consolidaciones, presupuestoRenglones } from "@/lib/schema";
import { eq, sql, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { gruposRenglonDeConsolidacion } from "./renglon-utils";

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

// Órdenes ya devengadas, en seguimiento de pago con la DAF (División de
// Administración Financiera). estado_devengado empieza en "Enviado" al
// devengar y de ahí puede pasar a "Rechazado" o "Pagado".
export async function getOrdenesEnviadasADaf() {
  const ordenes = await db.select().from(ordenesCompra)
    .where(sql`${ordenesCompra.estado_devengado} IS NOT NULL`)
    .orderBy(sql`fecha_envio_daf DESC`);
  return Promise.all(ordenes.map(async o => ({
    ...o, renglones: await gruposRenglonDeConsolidacion(o.consolidacion_id),
  })));
}

export type DevengarInput = { no_devengado: string; fecha_envio_daf: string };

// Devengar mueve el monto de Compromiso a Ejecutado (Devengado, separando
// Normal/Regularizado según cómo se adjudicó la consolidación original) y
// registra el No. de Devengado + Fecha de envío a la DAF de una vez — el
// pipeline entero termina aquí, la DAF es otra división a la que se le
// remite el expediente para trámite de pago, no algo que este sistema siga
// tramitando. Deja estado_devengado en "Enviado"; el seguimiento posterior
// (Rechazado/Pagado) se hace con actualizarEstadoDevengado.
export async function devengar(ordenId: number, input: DevengarInput): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    const no_devengado = input.no_devengado.trim();
    const fecha_envio_daf = input.fecha_envio_daf.trim();
    if (!no_devengado) return { error: "Ingresa el No. de Devengado" };
    if (!fecha_envio_daf) return { error: "Ingresa la fecha de envío a la DAF" };

    const [orden] = await db.select({
      estado: ordenesCompra.estado,
      consolidacion_id: ordenesCompra.consolidacion_id,
    }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "En Devengado") return { error: "Esta orden ya fue devengada" };

    const [con] = await db.select({ regularizado: consolidaciones.regularizado })
      .from(consolidaciones).where(eq(consolidaciones.id, orden.consolidacion_id)).limit(1);
    const esRegularizado = con?.regularizado === true;

    await db.update(ordenesCompra).set({
      estado: "Completada",
      no_devengado, fecha_envio_daf,
      estado_devengado: "Enviado",
    }).where(eq(ordenesCompra.id, ordenId));

    const renglones = await gruposRenglonDeConsolidacion(orden.consolidacion_id);
    for (const r of renglones) {
      await db.update(presupuestoRenglones).set({
        compromiso: sql`COALESCE(${presupuestoRenglones.compromiso}, 0) - ${r.total}`,
        ...(esRegularizado
          ? { devengado_regularizado: sql`COALESCE(${presupuestoRenglones.devengado_regularizado}, 0) + ${r.total}` }
          : { devengado: sql`COALESCE(${presupuestoRenglones.devengado}, 0) + ${r.total}` }),
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

export type EstadoDevengado = "Rechazado" | "Pagado";

// Seguimiento del envío a la DAF: de "Enviado" pasa a "Rechazado" o a
// "Pagado" (con fecha de pago obligatoria).
export async function actualizarEstadoDevengado(
  ordenId: number,
  estado: EstadoDevengado,
  fechaPago?: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    if (estado === "Pagado" && !fechaPago?.trim()) {
      return { error: "Ingresa la fecha de pago" };
    }

    const [orden] = await db.select({ estado_devengado: ordenesCompra.estado_devengado })
      .from(ordenesCompra).where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado_devengado !== "Enviado") {
      return { error: "Solo se puede cambiar el estado mientras esté Enviado" };
    }

    await db.update(ordenesCompra).set({
      estado_devengado: estado,
      fecha_pago: estado === "Pagado" ? fechaPago!.trim() : null,
    }).where(eq(ordenesCompra.id, ordenId));

    return { ok: true };
  } catch {
    return { error: "Error al actualizar el estado" };
  }
}
