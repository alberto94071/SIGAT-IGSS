"use server";
import { db } from "@/lib/db";
import { presupuestoRenglones } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { PRESUPUESTO_DATA } from "@/lib/presupuesto-general-data";

export type PresupuestoGeneralRow = {
  pg: string;
  spg: string;
  py: string;
  act: string;
  ob: string;
  geografico: string;
  fuente: string;
  org: string;
  corr: string;
  fteRef: string;
  corRef: string;
  renglon: number;
  descripcion: string;
  subProducto: string;
  vigente: number;
  modificado: number;
  nuevoVigente: number;
  programado: number | null;
  preCompromiso: number | null;
  compromiso: number | null;
  devengado: number | null;
  saldo: number | null;
  porcentajeEjecutado: number | null;
};

/**
 * Réplica de la pestaña "PRESUPUESTO" del Excel fuente. Los campos de
 * clasificación (PG..COR-REF) y los montos Vigente/Modificado vienen del
 * Excel; Pre-Compromiso, Compromiso y Devengado se cruzan en vivo con
 * presupuesto_renglones (misma tabla que ya actualizan a01-siaf, compromiso,
 * devengado y DAB-60), enlazando por renglón + sub-producto. Programado,
 * Saldo y % Ejecutado no tienen fuente todavía y quedan en null.
 */
export async function getPresupuestoGeneralData(): Promise<PresupuestoGeneralRow[]> {
  const vivos = await db.select({
    renglon:        presupuestoRenglones.renglon,
    subproducto:    presupuestoRenglones.subproducto,
    pre_compromiso: presupuestoRenglones.pre_compromiso,
    compromiso:     presupuestoRenglones.compromiso,
    devengado:      presupuestoRenglones.devengado,
  }).from(presupuestoRenglones).where(eq(presupuestoRenglones.ejercicio_fiscal, 2026));

  const vivosPorClave = new Map(
    vivos.map(v => [`${v.renglon}|${v.subproducto}`, v])
  );

  return PRESUPUESTO_DATA.map(r => {
    const vivo = vivosPorClave.get(`${r.renglon}|${r.subProducto}`);
    return {
      ...r,
      nuevoVigente: r.vigente + r.modificado,
      programado: null,
      preCompromiso: vivo?.pre_compromiso ?? null,
      compromiso: vivo?.compromiso ?? null,
      devengado: vivo?.devengado ?? null,
      saldo: null,
      porcentajeEjecutado: null,
    };
  });
}
