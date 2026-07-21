"use server";
import { db } from "@/lib/db";
import { programacionEntradas, presupuestoRenglones } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { EJECUCION_DATA } from "@/lib/ejecucion-data";

export type EjecucionRow = {
  renglon: number;
  descripcion: string;
  subProducto: string;
  nuevoVigente: number;
  modificacionesIngru: number;
  modificacionesNormal: number;
  modificacionAmpliacion: number;
  preCompromiso: number;
  compromisoNormal: number;
  compromisoRegularizado: number;
  ejecucionNormal: number;
  ejecucionRegularizado: number;
  programadoNormal: number;
  programadoRegularizado: number;
  saldoProgramadoNormal: number;
  saldoProgramadoRegularizado: number;
};

/**
 * Carga los datos de ejecución presupuestaria.
 *
 * - Saldo Programado Normal/Regularizado se cruzan en vivo con la suma de
 *   todo lo capturado en Programación y Reprogramación (programacion_entradas,
 *   los 4 meses de cada cuatrimestre) por renglón + sub-producto + tipo.
 * - Pre-Compromiso, Compromiso Normal y Ejecución Normal (= Devengado) se
 *   cruzan en vivo con presupuesto_renglones (misma tabla que ya actualizan
 *   A01-SIAF, Compromiso, Devengado y DAB-60), por renglón + sub-producto.
 *   Esa tabla aún no distingue Compromiso/Devengado por tipo (Normal vs
 *   Regularizado) — el valor vivo se muestra bajo "Normal" y "Regularizado"
 *   queda en 0 hasta que exista esa distinción en el origen de los datos.
 * - Modificaciones Ingru/Entre Renglones/Ampliación se cruzan en vivo con
 *   las mismas columnas que escribe Reprogramación (ver programacion-actions.ts
 *   guardarModificacion), también por renglón + sub-producto.
 */
export async function getEjecucionData(): Promise<EjecucionRow[]> {
  const [entradas, renglonesVivos] = await Promise.all([
    db.select({
      renglon:     programacionEntradas.renglon,
      subproducto: programacionEntradas.subproducto,
      tipo:        programacionEntradas.tipo,
      mes1:        programacionEntradas.mes1,
      mes2:        programacionEntradas.mes2,
      mes3:        programacionEntradas.mes3,
      mes4:        programacionEntradas.mes4,
    }).from(programacionEntradas).where(eq(programacionEntradas.ejercicio_fiscal, 2026)),
    db.select({
      renglon:        presupuestoRenglones.renglon,
      subproducto:    presupuestoRenglones.subproducto,
      pre_compromiso: presupuestoRenglones.pre_compromiso,
      compromiso:     presupuestoRenglones.compromiso,
      devengado:      presupuestoRenglones.devengado,
      modificacion_ingru:           presupuestoRenglones.modificacion_ingru,
      modificacion_entre_renglones: presupuestoRenglones.modificacion_entre_renglones,
      modificacion_ampliacion:      presupuestoRenglones.modificacion_ampliacion,
    }).from(presupuestoRenglones).where(eq(presupuestoRenglones.ejercicio_fiscal, 2026)),
  ]);

  const saldoPorClave = new Map<string, { normal: number; regularizado: number }>();
  for (const e of entradas) {
    const clave = `${e.renglon}|${e.subproducto}`;
    const acumulado = saldoPorClave.get(clave) ?? { normal: 0, regularizado: 0 };
    const total = e.mes1 + e.mes2 + e.mes3 + e.mes4;
    if (e.tipo === "normal") acumulado.normal += total;
    else acumulado.regularizado += total;
    saldoPorClave.set(clave, acumulado);
  }

  const vivoPorClave = new Map(renglonesVivos.map(r => [`${r.renglon}|${r.subproducto}`, r]));

  return EJECUCION_DATA.map(r => {
    const clave = `${r.renglon}|${r.subProducto}`;
    const saldo = saldoPorClave.get(clave);
    const vivo = vivoPorClave.get(clave);
    return {
      ...r,
      modificacionesIngru: vivo?.modificacion_ingru ?? 0,
      modificacionesNormal: vivo?.modificacion_entre_renglones ?? 0,
      modificacionAmpliacion: vivo?.modificacion_ampliacion ?? 0,
      preCompromiso: vivo?.pre_compromiso ?? 0,
      compromisoNormal: vivo?.compromiso ?? 0,
      compromisoRegularizado: 0,
      ejecucionNormal: vivo?.devengado ?? 0,
      ejecucionRegularizado: 0,
      saldoProgramadoNormal: saldo?.normal ?? 0,
      saldoProgramadoRegularizado: saldo?.regularizado ?? 0,
    };
  });
}
