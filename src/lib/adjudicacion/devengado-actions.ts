"use server";
import { db } from "@/lib/db";
import { ordenesCompra, consolidaciones, presupuestoRenglones } from "@/lib/schema";
import { eq, sql, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { requireModuloAccessAction } from "@/lib/modulo-access";
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

/** Órdenes con No. de Devengado ya registrado, esperando que Presupuesto lo apruebe. */
export async function getOrdenesDevengadoSolicitado() {
  const ordenes = await db.select().from(ordenesCompra).where(eq(ordenesCompra.estado, "Devengado Solicitado")).orderBy(sql`created_at ASC`);
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

/**
 * Registra el No. de Devengado + fecha de envío a la DAF y deja la orden
 * "Devengado Solicitado" — todavía NO mueve Compromiso a Ejecutado ni
 * arranca el seguimiento con la DAF. Eso solo pasa al aprobar (ver
 * aprobarDevengado), que requiere acceso al módulo de Presupuesto.
 */
export async function registrarDevengado(ordenId: number, input: DevengarInput): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    const no_devengado = input.no_devengado.trim();
    const fecha_envio_daf = input.fecha_envio_daf.trim();
    if (!no_devengado) return { error: "Ingresa el No. de Devengado" };
    if (!fecha_envio_daf) return { error: "Ingresa la fecha de envío a la DAF" };

    const [orden] = await db.select({ estado: ordenesCompra.estado }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "En Devengado") return { error: "Esta orden ya fue devengada" };

    await db.update(ordenesCompra).set({
      estado: "Devengado Solicitado", no_devengado, fecha_envio_daf,
    }).where(eq(ordenesCompra.id, ordenId));

    return { ok: true };
  } catch {
    return { error: "Error al registrar el devengado" };
  }
}

/**
 * Aprueba el Devengado — solo quien tenga acceso a mod_presupuesto. Recién
 * aquí se mueve el monto de Compromiso a Ejecutado (Devengado, separando
 * Normal/Regularizado según cómo se adjudicó la consolidación original), la
 * orden queda "Completada" y arranca el seguimiento con la DAF (División de
 * Administración Financiera) — estado_devengado "Enviado", que de ahí puede
 * pasar a "Rechazado" o "Pagado" con actualizarEstadoDevengado.
 *
 * El Compromiso se libera por el monto completo (r.total, lo que se había
 * comprometido) pero a Devengado solo entra el monto neto de IVA cuando la
 * orden NO está marcada exenta — el IGSS es agente retenedor: si algo
 * cuesta Q4,000 y no es exento, solo paga Q3,520 al proveedor (retiene 12%
 * para el SAT), y ese neto es lo que se ejecuta del presupuesto. Si está
 * exenta, se paga el monto completo.
 */
export async function aprobarDevengado(ordenId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireModuloAccessAction("mod_presupuesto");
    if ("error" in check) return check;

    const [orden] = await db.select({
      estado: ordenesCompra.estado,
      consolidacion_id: ordenesCompra.consolidacion_id,
      exento_iva: ordenesCompra.exento_iva,
    }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "Devengado Solicitado") return { error: "Esta orden no está pendiente de aprobación de Devengado" };

    const [con] = await db.select({ regularizado: consolidaciones.regularizado })
      .from(consolidaciones).where(eq(consolidaciones.id, orden.consolidacion_id)).limit(1);
    const esRegularizado = con?.regularizado === true;

    await db.update(ordenesCompra).set({
      estado: "Completada",
      estado_devengado: "Enviado",
    }).where(eq(ordenesCompra.id, ordenId));

    const renglones = await gruposRenglonDeConsolidacion(orden.consolidacion_id);
    for (const r of renglones) {
      const montoDevengado = orden.exento_iva ? r.total : r.total * 0.88;
      await db.update(presupuestoRenglones).set({
        compromiso: sql`COALESCE(${presupuestoRenglones.compromiso}, 0) - ${r.total}`,
        ...(esRegularizado
          ? { devengado_regularizado: sql`COALESCE(${presupuestoRenglones.devengado_regularizado}, 0) + ${montoDevengado}` }
          : { devengado: sql`COALESCE(${presupuestoRenglones.devengado}, 0) + ${montoDevengado}` }),
      }).where(and(
        eq(presupuestoRenglones.renglon, r.renglon as number),
        eq(presupuestoRenglones.subproducto, r.subproducto),
        eq(presupuestoRenglones.ejercicio_fiscal, 2026)
      ));
    }

    return { ok: true };
  } catch {
    return { error: "Error al aprobar el devengado" };
  }
}

/** Rechaza el Devengado mientras siga "Devengado Solicitado" — regresa a "En Devengado" para corregir. Solo quien tenga acceso a mod_presupuesto. */
export async function rechazarDevengado(ordenId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireModuloAccessAction("mod_presupuesto");
    if ("error" in check) return check;

    const [orden] = await db.select({ estado: ordenesCompra.estado }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "Devengado Solicitado") return { error: "Esta orden no está pendiente de aprobación de Devengado" };

    await db.update(ordenesCompra).set({
      estado: "En Devengado", no_devengado: null, fecha_envio_daf: null,
    }).where(eq(ordenesCompra.id, ordenId));

    return { ok: true };
  } catch {
    return { error: "Error al rechazar el devengado" };
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
