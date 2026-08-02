"use server";
import { db } from "@/lib/db";
import { programacionEntradas, presupuestoRenglones } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { EJECUCION_DATA } from "@/lib/ejecucion-data";
import { fechaGuatemala } from "@/lib/date-utils";
import { cuatrimestreDeFecha } from "@/lib/programacion-constants";

export type EjecucionRow = {
  renglon: number;
  descripcion: string;
  subProducto: string;
  nuevoVigente: number;
  modificacionesIngru: number;
  modificacionesNormal: number;
  modificacionAmpliacion: number;
  preCompromiso: number;
  compromiso: number;
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
 * - Programado Normal/Regularizado es lo capturado en programacion_entradas
 *   para el CUATRIMESTRE VIGENTE (según la fecha de hoy), por renglón +
 *   sub-producto + tipo.
 * - Saldo Programado Normal/Regularizado se cruza en vivo con la suma de
 *   TODOS los cuatrimestres capturados en Programación y Reprogramación
 *   (programacion_entradas, los 4 meses de cada uno) por renglón +
 *   sub-producto + tipo — se deja igual que antes a propósito, ver
 *   calcularTotales() en EjecucionClient.tsx (fórmula preservada del Excel
 *   fuente del cliente).
 * - Pre-Compromiso, Compromiso (columna única, sin distinguir Normal/
 *   Regularizado) y Ejecución Normal/Regularizado (= Devengado) se cruzan en
 *   vivo con presupuesto_renglones (misma tabla que ya actualizan A01-SIAF,
 *   Compromiso y Devengado), por renglón + sub-producto.
 * - Modificaciones Ingru/Entre Renglones/Ampliación se cruzan en vivo con
 *   las mismas columnas que escribe Reprogramación (ver programacion-actions.ts
 *   guardarModificacion), también por renglón + sub-producto.
 */
export async function getEjecucionData(): Promise<EjecucionRow[]> {
  const cuatrimestreVigente = cuatrimestreDeFecha(fechaGuatemala());

  const [entradas, renglonesVivos] = await Promise.all([
    db.select({
      renglon:     programacionEntradas.renglon,
      subproducto: programacionEntradas.subproducto,
      tipo:        programacionEntradas.tipo,
      cuatrimestre: programacionEntradas.cuatrimestre,
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
      devengado_regularizado: presupuestoRenglones.devengado_regularizado,
      modificacion_ingru:           presupuestoRenglones.modificacion_ingru,
      modificacion_entre_renglones: presupuestoRenglones.modificacion_entre_renglones,
      modificacion_ampliacion:      presupuestoRenglones.modificacion_ampliacion,
    }).from(presupuestoRenglones).where(eq(presupuestoRenglones.ejercicio_fiscal, 2026)),
  ]);

  const saldoPorClave = new Map<string, { normal: number; regularizado: number }>();
  const programadoPorClave = new Map<string, { normal: number; regularizado: number }>();
  for (const e of entradas) {
    const clave = `${e.renglon}|${e.subproducto}`;
    const total = e.mes1 + e.mes2 + e.mes3 + e.mes4;

    const acumulado = saldoPorClave.get(clave) ?? { normal: 0, regularizado: 0 };
    if (e.tipo === "normal") acumulado.normal += total;
    else acumulado.regularizado += total;
    saldoPorClave.set(clave, acumulado);

    if (e.cuatrimestre === cuatrimestreVigente) {
      const delCuatrimestre = programadoPorClave.get(clave) ?? { normal: 0, regularizado: 0 };
      if (e.tipo === "normal") delCuatrimestre.normal += total;
      else delCuatrimestre.regularizado += total;
      programadoPorClave.set(clave, delCuatrimestre);
    }
  }

  const vivoPorClave = new Map(renglonesVivos.map(r => [`${r.renglon}|${r.subproducto}`, r]));

  return EJECUCION_DATA.map(r => {
    const clave = `${r.renglon}|${r.subProducto}`;
    const saldo = saldoPorClave.get(clave);
    const programado = programadoPorClave.get(clave);
    const vivo = vivoPorClave.get(clave);
    return {
      ...r,
      modificacionesIngru: vivo?.modificacion_ingru ?? 0,
      modificacionesNormal: vivo?.modificacion_entre_renglones ?? 0,
      modificacionAmpliacion: vivo?.modificacion_ampliacion ?? 0,
      preCompromiso: vivo?.pre_compromiso ?? 0,
      compromiso: vivo?.compromiso ?? 0,
      ejecucionNormal: vivo?.devengado ?? 0,
      ejecucionRegularizado: vivo?.devengado_regularizado ?? 0,
      programadoNormal: programado?.normal ?? 0,
      programadoRegularizado: programado?.regularizado ?? 0,
      saldoProgramadoNormal: saldo?.normal ?? 0,
      saldoProgramadoRegularizado: saldo?.regularizado ?? 0,
    };
  });
}
