"use server";
import { db } from "@/lib/db";
import { programacionEntradas } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { EJECUCION_DATA } from "@/lib/ejecucion-data";

export type EjecucionRow = {
  renglon: number;
  descripcion: string;
  subProducto: string;
  nuevoVigente: number;
  modificacionesIngru: number;
  modificacionesNormal: number;
  ejecucionNormal: number;
  ejecucionRegularizado: number;
  programadoNormal: number;
  programadoRegularizado: number;
  saldoProgramadoNormal: number;
  saldoProgramadoRegularizado: number;
};

/**
 * Carga los datos de ejecución presupuestaria. Saldo Programado Normal/
 * Regularizado ya no son estáticos: se cruzan en vivo con la suma de todo
 * lo capturado en Programación y Reprogramación (programacion_entradas,
 * los 4 meses de cada cuatrimestre) por renglón + sub-producto + tipo.
 */
export async function getEjecucionData(): Promise<EjecucionRow[]> {
  const entradas = await db.select({
    renglon:     programacionEntradas.renglon,
    subproducto: programacionEntradas.subproducto,
    tipo:        programacionEntradas.tipo,
    mes1:        programacionEntradas.mes1,
    mes2:        programacionEntradas.mes2,
    mes3:        programacionEntradas.mes3,
    mes4:        programacionEntradas.mes4,
  }).from(programacionEntradas).where(eq(programacionEntradas.ejercicio_fiscal, 2026));

  const saldoPorClave = new Map<string, { normal: number; regularizado: number }>();
  for (const e of entradas) {
    const clave = `${e.renglon}|${e.subproducto}`;
    const acumulado = saldoPorClave.get(clave) ?? { normal: 0, regularizado: 0 };
    const total = e.mes1 + e.mes2 + e.mes3 + e.mes4;
    if (e.tipo === "normal") acumulado.normal += total;
    else acumulado.regularizado += total;
    saldoPorClave.set(clave, acumulado);
  }

  return EJECUCION_DATA.map(r => {
    const vivo = saldoPorClave.get(`${r.renglon}|${r.subProducto}`);
    return {
      ...r,
      saldoProgramadoNormal: vivo?.normal ?? 0,
      saldoProgramadoRegularizado: vivo?.regularizado ?? 0,
    };
  });
}
