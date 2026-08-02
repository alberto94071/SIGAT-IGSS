// Ventanas de fecha y aprobación automática de Programación y
// Reprogramación (ver implementation_plan.md, Fase 3). Construido sobre las
// primitivas de días hábiles de dias-habiles.ts.
import {
  nEsimoDiaHabilDelMes, estaEnPrimerosNDiasHabiles, estaEnRangoDiasDelMes, estaEnMeses,
} from "@/lib/dias-habiles";

// Mes (1-12) en que se crea la Programación de cada cuatrimestre: se
// programa un cuatrimestre durante el último mes del cuatrimestre anterior
// (excepto el cuatrimestre 1, que se programa en su propio primer mes).
const MES_CREACION_PROGRAMACION: Record<number, number> = { 1: 1, 2: 4, 3: 8 };

// Meses en que se puede crear/editar una Reprogramación, para cualquier cuatrimestre.
const MESES_REPROGRAMACION = [2, 3, 5, 6, 7, 9, 10, 11];

function anioMes(fecha: string): { anio: number; mes: number } {
  return { anio: Number(fecha.slice(0, 4)), mes: Number(fecha.slice(5, 7)) };
}

// ¿Se puede crear/editar hoy la Programación de este cuatrimestre?
export function ventanaProgramacionAbierta(cuatrimestre: number, fecha: string): boolean {
  const mesEsperado = MES_CREACION_PROGRAMACION[cuatrimestre];
  if (!mesEsperado) return false;
  const { mes } = anioMes(fecha);
  if (mes !== mesEsperado) return false;
  return estaEnPrimerosNDiasHabiles(fecha, 5);
}

// ¿Se puede crear/editar hoy una Reprogramación (cualquier cuatrimestre)?
export function ventanaReprogramacionAbierta(fecha: string): boolean {
  const { mes } = anioMes(fecha);
  if (!MESES_REPROGRAMACION.includes(mes)) return false;
  return estaEnPrimerosNDiasHabiles(fecha, 5);
}

// Nombre del mes esperado para mostrar en mensajes de error.
const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function mesCreacionProgramacionLabel(cuatrimestre: number): string {
  return NOMBRE_MES[(MES_CREACION_PROGRAMACION[cuatrimestre] ?? 1) - 1];
}

export function mesesReprogramacionLabel(): string {
  return MESES_REPROGRAMACION.map(m => NOMBRE_MES[m - 1]).join(", ");
}

// Fecha (YYYY-MM-DD) en la que una solicitud pasa automáticamente de
// "Solicitado" a "Aprobado", según el mes en que se creó/editó por última
// vez. Enero (Programación C1) aprueba el 6to día hábil del propio enero;
// abril (Programación C2) aprueba el 1er día hábil de mayo; agosto
// (Programación C3) aprueba el 1er día hábil de septiembre; cualquier mes
// de Reprogramación aprueba el 6to día hábil de ese mismo mes (justo
// después de que cierra su ventana de 5 días hábiles para crearla/editarla).
export function fechaAprobacionAutomatica(anio: number, mesUltimaEdicion: number): string {
  if (mesUltimaEdicion === 1) return nEsimoDiaHabilDelMes(anio, 1, 6);
  if (mesUltimaEdicion === 4) return nEsimoDiaHabilDelMes(anio, 5, 1);
  if (mesUltimaEdicion === 8) return nEsimoDiaHabilDelMes(anio, 9, 1);
  return nEsimoDiaHabilDelMes(anio, mesUltimaEdicion, 6);
}

// ─── Modificaciones presupuestarias (Ingru / Transferencia / Ampliación) ───
// Meses en que aplican Ingru y Transferencia: de febrero a diciembre.
const MESES_MODIFICACION = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MESES_AMPLIACION = [4, 7, 9]; // abril, julio, septiembre

// Ingru: 1er o 2do día hábil de cada mes (feb-dic).
export function ventanaIngruAbierta(fecha: string): boolean {
  return estaEnMeses(fecha, MESES_MODIFICACION) && estaEnPrimerosNDiasHabiles(fecha, 2);
}

// Transferencia entre renglón/sub-producto: del 15 al 20 de cada mes (feb-dic).
export function ventanaTransferenciaAbierta(fecha: string): boolean {
  return estaEnMeses(fecha, MESES_MODIFICACION) && estaEnRangoDiasDelMes(fecha, 15, 20);
}

// Ampliación: solo en abril, julio y septiembre (sin restricción de día del mes).
export function ventanaAmpliacionAbierta(fecha: string): boolean {
  return estaEnMeses(fecha, MESES_AMPLIACION);
}
