"use server";
import { db } from "@/lib/db";
import { programacionEntradas, presupuestoRenglones } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { EJECUCION_DATA } from "@/lib/ejecucion-data";
import { fechaGuatemala } from "@/lib/date-utils";
import { cuatrimestreDeFecha } from "@/lib/programacion-constants";

export type EjecucionRow = {
  renglon: number;
  descripcion: string;
  subProducto: string;
  vigente: number;
  modificacionesIngru: number;
  modificacionesNormal: number;
  modificacionAmpliacion: number;
  disponible: number;
  preCompromiso: number;
  compromiso: number;
  ejecucionNormal: number;
  ejecucionRegularizado: number;
  programadoNormal: number;
  programadoRegularizado: number;
  saldoProgramadoNormal: number;
  saldoProgramadoRegularizado: number;
  totalProgramado: number;
  saldo: number;
};

/**
 * Carga los datos de ejecución presupuestaria. Lógica confirmada con el
 * cliente (ver conversación) para cada columna, por renglón + sub-producto:
 *
 * - Vigente: presupuesto base del año, fijo (catálogo, EJECUCION_DATA).
 * - Modificaciones Ingru/Entre Renglones/Ampliación: en vivo desde
 *   presupuesto_renglones (mismas columnas que escribe Reprogramación).
 * - Disponible = Vigente + las 3 Modificaciones. Solo cambia cuando se
 *   aprueba una modificación.
 * - Pre-Compromiso, Compromiso, Ejecución Normal/Regularizado (=Devengado):
 *   en vivo desde presupuesto_renglones, igual que antes.
 * - Programado Normal/Regularizado: lo Aprobado en Programación/
 *   Reprogramación para el CUATRIMESTRE VIGENTE únicamente (cambia de
 *   valor solo por venir de otra fila en programacion_entradas, no se sigue
 *   acumulando dentro del mismo cuatrimestre).
 * - Total Programado = Programado Normal + Programado Regularizado del
 *   cuatrimestre vigente (una sola columna, sin dividir Normal/Regularizado).
 * - Saldo Programado Normal/Regularizado = Programado (del cuatrimestre
 *   vigente) − Ejecución, por tipo. Se recalcula solo conforme avanza la
 *   ejecución dentro del mismo cuatrimestre.
 * - Saldo = Disponible − la suma de Total Programado de TODOS los
 *   cuatrimestres Aprobados del año (no solo el vigente) − No Ejecutado
 *   acumulado (lo que caducó sin comprometerse en cuatrimestres ya
 *   cerrados, ver cierre-cuatrimestre.ts) — es lo único que queda sin
 *   asignar a ningún cuatrimestre todavía, y por eso es lo único que se
 *   puede mover a otro renglón vía Transferencia (ver getSaldoRenglon en
 *   presupuesto-disponible.ts, misma fórmula).
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
    }).from(programacionEntradas).where(and(
      eq(programacionEntradas.ejercicio_fiscal, 2026),
      eq(programacionEntradas.estado, "Aprobado"),
    )),
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
      no_ejecutado:                 presupuestoRenglones.no_ejecutado,
    }).from(presupuestoRenglones).where(eq(presupuestoRenglones.ejercicio_fiscal, 2026)),
  ]);

  // Acumulado: suma de TODOS los cuatrimestres del año (para Saldo).
  const acumuladoPorClave = new Map<string, number>();
  // Solo el cuatrimestre vigente, por tipo (para Programado/Saldo Programado).
  const programadoPorClave = new Map<string, { normal: number; regularizado: number }>();

  for (const e of entradas) {
    const clave = `${e.renglon}|${e.subproducto}`;
    const total = e.mes1 + e.mes2 + e.mes3 + e.mes4;

    acumuladoPorClave.set(clave, (acumuladoPorClave.get(clave) ?? 0) + total);

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
    const vivo = vivoPorClave.get(clave);
    const programado = programadoPorClave.get(clave) ?? { normal: 0, regularizado: 0 };
    const acumulado = acumuladoPorClave.get(clave) ?? 0;

    const modificacionesIngru = vivo?.modificacion_ingru ?? 0;
    const modificacionesNormal = vivo?.modificacion_entre_renglones ?? 0;
    const modificacionAmpliacion = vivo?.modificacion_ampliacion ?? 0;
    const disponible = r.nuevoVigente + modificacionesIngru + modificacionesNormal + modificacionAmpliacion;

    const ejecucionNormal = vivo?.devengado ?? 0;
    const ejecucionRegularizado = vivo?.devengado_regularizado ?? 0;

    return {
      renglon: r.renglon,
      descripcion: r.descripcion,
      subProducto: r.subProducto,
      vigente: r.nuevoVigente,
      modificacionesIngru,
      modificacionesNormal,
      modificacionAmpliacion,
      disponible,
      preCompromiso: vivo?.pre_compromiso ?? 0,
      compromiso: vivo?.compromiso ?? 0,
      ejecucionNormal,
      ejecucionRegularizado,
      programadoNormal: programado.normal,
      programadoRegularizado: programado.regularizado,
      saldoProgramadoNormal: programado.normal - ejecucionNormal,
      saldoProgramadoRegularizado: programado.regularizado - ejecucionRegularizado,
      totalProgramado: programado.normal + programado.regularizado,
      saldo: disponible - acumulado - (vivo?.no_ejecutado ?? 0),
    };
  });
}
