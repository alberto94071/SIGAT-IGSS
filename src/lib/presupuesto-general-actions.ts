"use server";
import { db } from "@/lib/db";
import { presupuestoRenglones, programacionEntradas } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";
import { PRESUPUESTO_DATA } from "@/lib/presupuesto-general-data";
import { requireModuloAccessAction } from "@/lib/modulo-access";

export type PresupuestoGeneralRow = {
  renglon: number;
  descripcion: string;
  subProducto: string;
  vigente: number;
  ingru: number | null;
  entreRenglones: number | null;
  nuevoVigente: number;
  programado: number | null;
  devengado: number | null;
  noEjecutado: number | null;
  saldoPresupuestario: number | null;
  porcentajeEjecucion: number | null;
};

/**
 * Réplica de la pestaña "PRESUPUESTO" del Excel fuente — a diferencia de
 * Ejecución (que es por cuatrimestre), esta pantalla es el RESUMEN
 * HISTÓRICO ACUMULADO de todo el año, en vivo:
 *
 * - Ingru / Entre Renglones: valor vivo de presupuesto_renglones (mismas
 *   columnas que Ejecución) — Entre Renglones ya es en sí un acumulado neto
 *   (+destino/-origen de cada transferencia aprobada).
 * - Nuevo Vigente = Vigente + Ingru + Entre Renglones + Ampliación (esta
 *   última no tiene columna propia aquí, igual que antes, pero sí se suma).
 * - Programado = suma de TODO lo Aprobado en Programación/Reprogramación en
 *   TODOS los cuatrimestres del año (no solo el vigente).
 * - Devengado = Devengado Normal + Devengado Regularizado (combinados, sin
 *   dividir, a diferencia de Ejecución).
 * - No Ejecutado = presupuesto_renglones.no_ejecutado — lo que caducó sin
 *   comprometerse en cuatrimestres ya cerrados (ver cierre-cuatrimestre.ts),
 *   perdido hasta que se libere (ver liberarNoEjecutado).
 * - Saldo Presupuestario = el mismo Saldo que Ejecución (Nuevo Vigente −
 *   Programado acumulado − No Ejecutado).
 * - % Ejecución = Devengado / Vigente × 100.
 */
export async function getPresupuestoGeneralData(): Promise<PresupuestoGeneralRow[]> {
  const [vivos, entradas] = await Promise.all([
    db.select({
      renglon:     presupuestoRenglones.renglon,
      subproducto: presupuestoRenglones.subproducto,
      devengado:   presupuestoRenglones.devengado,
      devengado_regularizado: presupuestoRenglones.devengado_regularizado,
      modificacion_ingru:           presupuestoRenglones.modificacion_ingru,
      modificacion_entre_renglones: presupuestoRenglones.modificacion_entre_renglones,
      modificacion_ampliacion:      presupuestoRenglones.modificacion_ampliacion,
      no_ejecutado:                 presupuestoRenglones.no_ejecutado,
    }).from(presupuestoRenglones).where(eq(presupuestoRenglones.ejercicio_fiscal, 2026)),
    db.select({
      renglon:     programacionEntradas.renglon,
      subproducto: programacionEntradas.subproducto,
      mes1:        programacionEntradas.mes1,
      mes2:        programacionEntradas.mes2,
      mes3:        programacionEntradas.mes3,
      mes4:        programacionEntradas.mes4,
    }).from(programacionEntradas).where(and(
      eq(programacionEntradas.ejercicio_fiscal, 2026),
      eq(programacionEntradas.estado, "Aprobado"),
    )),
  ]);

  const vivosPorClave = new Map(
    vivos.map(v => [`${v.renglon}|${v.subproducto}`, v])
  );

  const programadoPorClave = new Map<string, number>();
  for (const e of entradas) {
    const clave = `${e.renglon}|${e.subproducto}`;
    const total = e.mes1 + e.mes2 + e.mes3 + e.mes4;
    programadoPorClave.set(clave, (programadoPorClave.get(clave) ?? 0) + total);
  }

  return PRESUPUESTO_DATA.map(r => {
    const clave = `${r.renglon}|${r.subProducto}`;
    const vivo = vivosPorClave.get(clave);

    const ingru = vivo?.modificacion_ingru ?? 0;
    const entreRenglones = vivo?.modificacion_entre_renglones ?? 0;
    const ampliacion = vivo?.modificacion_ampliacion ?? 0;
    const nuevoVigente = r.vigente + ingru + entreRenglones + ampliacion;

    const programado = programadoPorClave.get(clave) ?? 0;
    const devengado = (vivo?.devengado ?? 0) + (vivo?.devengado_regularizado ?? 0);
    const noEjecutado = vivo?.no_ejecutado ?? 0;
    const saldoPresupuestario = nuevoVigente - programado - noEjecutado;
    const porcentajeEjecucion = r.vigente > 0 ? (devengado / r.vigente) * 100 : 0;

    return {
      ...r,
      ingru,
      entreRenglones,
      nuevoVigente,
      programado,
      devengado,
      noEjecutado,
      saldoPresupuestario,
      porcentajeEjecucion,
    };
  });
}

/**
 * Libera TODO lo acumulado en No Ejecutado (de todos los renglones/sub-
 * productos) y lo regresa a Saldo — solo quien tenga acceso a
 * mod_presupuesto, y solo cuando así lo autoricen desde el nivel central
 * (revisión de fin de año). No hay forma de liberar parcialmente por
 * renglón todavía — es una decisión que llega para todo el ejercicio a la vez.
 */
export async function liberarNoEjecutado(): Promise<{ ok: true; total: number } | { error: string }> {
  const check = await requireModuloAccessAction("mod_presupuesto");
  if ("error" in check) return check;

  const [{ total }] = await db.select({
    total: sql<number>`COALESCE(SUM(${presupuestoRenglones.no_ejecutado}), 0)`,
  }).from(presupuestoRenglones).where(eq(presupuestoRenglones.ejercicio_fiscal, 2026));

  await db.update(presupuestoRenglones)
    .set({ no_ejecutado: 0 })
    .where(and(
      eq(presupuestoRenglones.ejercicio_fiscal, 2026),
      sql`${presupuestoRenglones.no_ejecutado} != 0`,
    ));

  return { ok: true, total: Number(total ?? 0) };
}
