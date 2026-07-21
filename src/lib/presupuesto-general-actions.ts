"use server";
import { db } from "@/lib/db";
import { presupuestoRenglones } from "@/lib/schema";
import { eq } from "drizzle-orm";
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
 * devengado y DAB-60), enlazando por renglón + sub-producto. Ingru, Entre
 * Renglones, Programado, Saldo Presupuestario y % Ejecución no tienen fuente
 * todavía y quedan en null.
 */
export async function getPresupuestoGeneralData(): Promise<PresupuestoGeneralRow[]> {
  const vivos = await db.select({
    renglon:     presupuestoRenglones.renglon,
    subproducto: presupuestoRenglones.subproducto,
    devengado:   presupuestoRenglones.devengado,
  }).from(presupuestoRenglones).where(eq(presupuestoRenglones.ejercicio_fiscal, 2026));

  const vivosPorClave = new Map(
    vivos.map(v => [`${v.renglon}|${v.subproducto}`, v])
  );

  return PRESUPUESTO_DATA.map(r => {
    const vivo = vivosPorClave.get(`${r.renglon}|${r.subProducto}`);
    return {
      ...r,
      ingru: null,
      entreRenglones: null,
      nuevoVigente: r.vigente,
      programado: null,
      devengado: vivo?.devengado ?? null,
      saldoPresupuestario: null,
      porcentajeEjecucion: null,
    };
  });
}
