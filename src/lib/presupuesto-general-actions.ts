"use server";
import { db } from "@/lib/db";
import { presupuestoRenglones, programacionEntradas } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { PRESUPUESTO_DATA } from "@/lib/presupuesto-general-data";

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
  saldoPresupuestario: number | null;
  porcentajeEjecucion: number | null;
};

/**
 * Réplica de la pestaña "PRESUPUESTO" del Excel fuente. Renglón, Descripción,
 * Sub-Producto y Vigente vienen del Excel; Devengado se cruza en vivo con
 * presupuesto_renglones (misma tabla que ya actualizan a01-siaf, compromiso,
 * devengado y DAB-60), enlazando por renglón + sub-producto. Programado suma
 * lo ya Aprobado en programacion_entradas (Programación + Reprogramación,
 * todos los cuatrimestres/tipos). Ingru, Entre Renglones, Saldo
 * Presupuestario y % Ejecución no tienen fuente todavía y quedan en null.
 */
export async function getPresupuestoGeneralData(): Promise<PresupuestoGeneralRow[]> {
  const [vivos, entradas] = await Promise.all([
    db.select({
      renglon:     presupuestoRenglones.renglon,
      subproducto: presupuestoRenglones.subproducto,
      devengado:   presupuestoRenglones.devengado,
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
    return {
      ...r,
      ingru: null,
      entreRenglones: null,
      nuevoVigente: r.vigente,
      programado: programadoPorClave.get(clave) ?? null,
      devengado: vivo?.devengado ?? null,
      saldoPresupuestario: null,
      porcentajeEjecucion: null,
    };
  });
}
