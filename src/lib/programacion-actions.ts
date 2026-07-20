"use server";
import { PROGRAMACION_DATA } from "@/lib/programacion-data";

export type ProgramacionRow = {
  renglon: number;
  descripcion: string;
  subProducto: string;
  presupuestario: number;
  septiembre_normal: number;
  septiembre_regularizado: number;
  octubre_normal: number;
  octubre_regularizado: number;
  noviembre_normal: number;
  noviembre_regularizado: number;
  diciembre_normal: number;
  diciembre_regularizado: number;
  total_normal: number;
  total_regularizado: number;
  saldo: number;
};

/**
 * Carga los datos de programación presupuestaria
 * Devuelve un array de ProgramacionRow con todos los renglones
 */
export async function getProgramacionData(): Promise<ProgramacionRow[]> {
  return PROGRAMACION_DATA;
}
