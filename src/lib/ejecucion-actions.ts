"use server";
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
 * Carga los datos de ejecución presupuestaria
 * Devuelve un array de EjecucionRow con todos los renglones
 */
export async function getEjecucionData(): Promise<EjecucionRow[]> {
  return EJECUCION_DATA;
}
