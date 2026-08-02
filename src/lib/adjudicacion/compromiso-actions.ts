"use server";
import { db } from "@/lib/db";
import { ordenesCompra } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { requireModuloAccessAction } from "@/lib/modulo-access";
import { gruposRenglonDeConsolidacion } from "./renglon-utils";
import { presupuestoRenglones, programacionEntradas, programacionCompromisos } from "@/lib/schema";
import { and } from "drizzle-orm";
import { requiereDab60, cuatrimestreDeFecha } from "@/lib/programacion-constants";
import { fechaGuatemala } from "@/lib/date-utils";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export async function getOrdenesEnCompromiso() {
  const ordenes = await db.select().from(ordenesCompra).where(eq(ordenesCompra.estado, "En Compromiso")).orderBy(sql`created_at ASC`);
  return Promise.all(ordenes.map(async o => ({
    ...o, renglones: await gruposRenglonDeConsolidacion(o.consolidacion_id),
  })));
}

/** Órdenes con el No. de Compromiso ya registrado, esperando que Presupuesto lo apruebe. */
export async function getOrdenesCompromisoSolicitado() {
  const ordenes = await db.select().from(ordenesCompra).where(eq(ordenesCompra.estado, "Compromiso Solicitado")).orderBy(sql`created_at ASC`);
  return Promise.all(ordenes.map(async o => ({
    ...o, renglones: await gruposRenglonDeConsolidacion(o.consolidacion_id),
  })));
}

/**
 * Registra el No. de Compromiso de una orden y la deja "Compromiso
 * Solicitado" — todavía NO mueve presupuesto ni la deja pasar a Almacén/
 * DAB-60/Devengado. Eso solo pasa al aprobar (ver aprobarCompromiso), que
 * requiere acceso al módulo de Presupuesto.
 */
export async function registrarCompromiso(ordenId: number, noCompromiso: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (!noCompromiso.trim()) return { error: "El No. de Compromiso es obligatorio" };

    const [orden] = await db.select({ estado: ordenesCompra.estado }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "En Compromiso") return { error: "Esta orden ya fue enviada a Devengado" };

    await db.update(ordenesCompra).set({
      no_compromiso: noCompromiso.trim(), estado: "Compromiso Solicitado",
    }).where(eq(ordenesCompra.id, ordenId));

    return { ok: true };
  } catch {
    return { error: "Error al registrar el compromiso" };
  }
}

/**
 * Aprueba el Compromiso — solo quien tenga acceso a mod_presupuesto. Recién
 * aquí se mueve Pre-Compromiso → Compromiso y la orden puede avanzar a
 * Almacén/DAB-60 o Devengado; antes de esto queda bloqueada.
 */
export async function aprobarCompromiso(ordenId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireModuloAccessAction("mod_presupuesto");
    if ("error" in check) return check;

    const [orden] = await db.select({
      estado: ordenesCompra.estado,
      consolidacion_id: ordenesCompra.consolidacion_id,
      no_compromiso: ordenesCompra.no_compromiso,
    }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "Compromiso Solicitado") return { error: "Esta orden no está pendiente de aprobación de Compromiso" };

    const renglones = await gruposRenglonDeConsolidacion(orden.consolidacion_id);

    // Insumos (renglones 200-299/300-399, salvo servicios 261/266/295) pasan
    // primero por Almacén/DAB-60; el resto va directo a Devengado.
    const necesitaDab60 = renglones.some(r => requiereDab60(r.renglon));
    const siguienteEstado = necesitaDab60 ? "Pendiente DAB-60" : "En Devengado";

    await db.update(ordenesCompra).set({ estado: siguienteEstado }).where(eq(ordenesCompra.id, ordenId));

    const cuatrimestreActual = cuatrimestreDeFecha(fechaGuatemala());

    for (const r of renglones) {
      await db.update(presupuestoRenglones).set({
        pre_compromiso: sql`COALESCE(${presupuestoRenglones.pre_compromiso}, 0) - ${r.total}`,
        compromiso: sql`COALESCE(${presupuestoRenglones.compromiso}, 0) + ${r.total}`,
        saldo_disponible: sql`COALESCE(${presupuestoRenglones.saldo_disponible}, 0) - ${r.total}`
      }).where(and(
        eq(presupuestoRenglones.renglon, r.renglon as number),
        eq(presupuestoRenglones.subproducto, r.subproducto),
        eq(presupuestoRenglones.ejercicio_fiscal, 2026)
      ));

      // Ledger para la caducidad de cuatrimestre (ver cierre-cuatrimestre.ts):
      // el Compromiso solo aplica a Órdenes de Compra (Normal), nunca a Fondo
      // Rotativo. Si no hay una entrada de Programación vigente para este
      // renglón/sub-producto en el cuatrimestre actual, no hay nada que
      // registrar (no se podrá trasladar, que es lo correcto).
      const [entrada] = await db.select({ id: programacionEntradas.id })
        .from(programacionEntradas).where(and(
          eq(programacionEntradas.ejercicio_fiscal, 2026),
          eq(programacionEntradas.cuatrimestre, cuatrimestreActual),
          eq(programacionEntradas.renglon, r.renglon as number),
          eq(programacionEntradas.subproducto, r.subproducto),
          eq(programacionEntradas.tipo, "normal"),
        )).limit(1);

      if (entrada) {
        await db.insert(programacionCompromisos).values({
          programacion_entrada_id: entrada.id,
          orden_id: ordenId,
          no_compromiso: orden.no_compromiso ?? "",
          monto: r.total,
        });
      }
    }

    return { ok: true };
  } catch {
    return { error: "Error al aprobar el compromiso" };
  }
}

/** Rechaza el Compromiso mientras siga "Compromiso Solicitado" — regresa a "En Compromiso" para corregir el número. Solo quien tenga acceso a mod_presupuesto. */
export async function rechazarCompromiso(ordenId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireModuloAccessAction("mod_presupuesto");
    if ("error" in check) return check;

    const [orden] = await db.select({ estado: ordenesCompra.estado }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "Compromiso Solicitado") return { error: "Esta orden no está pendiente de aprobación de Compromiso" };

    await db.update(ordenesCompra).set({
      estado: "En Compromiso", no_compromiso: null,
    }).where(eq(ordenesCompra.id, ordenId));

    return { ok: true };
  } catch {
    return { error: "Error al rechazar el compromiso" };
  }
}
