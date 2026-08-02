// Ventanas de fecha y aprobación automática de Programación y
// Reprogramación (ver implementation_plan.md, Fase 3). Construido sobre las
// primitivas de días hábiles de dias-habiles.ts.
//
// Regla confirmada con el cliente: SOLICITAR (Reprogramación y las 3
// modificaciones — Ingru, Entre Renglones, Ampliación) no tiene ventana de
// fecha, se puede cualquier día del año. Lo único que se bloquea es el
// botón de APROBAR — y solo entra a funcionar en el presupuesto una vez
// aprobada. Programación (la primera vez que se asigna un renglón dentro de
// un cuatrimestre) sigue siendo la única con ventana también en el
// registro, porque abre solo un mes específico por cuatrimestre.
import {
  nEsimoDiaHabilDelMes, estaEnPrimerosNDiasHabiles, estaEnRangoDiasDelMes,
} from "@/lib/dias-habiles";

// Mes (1-12) en que se crea la Programación de cada cuatrimestre: se
// programa un cuatrimestre durante el último mes del cuatrimestre anterior
// (excepto el cuatrimestre 1, que se programa en su propio primer mes).
const MES_CREACION_PROGRAMACION: Record<number, number> = { 1: 1, 2: 4, 3: 8 };

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

// Nombre del mes esperado para mostrar en mensajes de error.
const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function mesCreacionProgramacionLabel(cuatrimestre: number): string {
  return NOMBRE_MES[(MES_CREACION_PROGRAMACION[cuatrimestre] ?? 1) - 1];
}

// Fecha (YYYY-MM-DD) en la que una Programación pasa automáticamente de
// "Solicitado" a "Aprobado", según el mes en que se creó. Enero (C1) aprueba
// el 6to día hábil del propio enero; abril (C2) aprueba el 1er día hábil de
// mayo; agosto (C3) aprueba el 1er día hábil de septiembre. Solo aplica a
// Programación — Reprogramación y Modificaciones usan sus propias ventanas
// de aprobación (ver ventanaAprobacionReprogramacionAbierta /
// ventanaAprobacionModificacionAbierta abajo), que no dependen de cuándo se
// solicitaron.
export function fechaAprobacionAutomatica(anio: number, mesUltimaEdicion: number): string {
  if (mesUltimaEdicion === 1) return nEsimoDiaHabilDelMes(anio, 1, 6);
  if (mesUltimaEdicion === 4) return nEsimoDiaHabilDelMes(anio, 5, 1);
  if (mesUltimaEdicion === 8) return nEsimoDiaHabilDelMes(anio, 9, 1);
  return nEsimoDiaHabilDelMes(anio, mesUltimaEdicion, 6);
}

// Reprogramación: se puede solicitar cualquier día, pero solo se puede
// APROBAR durante los primeros 5 días hábiles de cada mes (recurrente, no
// depende de en qué mes se solicitó).
export function ventanaAprobacionReprogramacionAbierta(fecha: string): boolean {
  return estaEnPrimerosNDiasHabiles(fecha, 5);
}

// Modificaciones presupuestarias (Ingru, Entre Renglones, Ampliación): se
// pueden solicitar cualquier día, pero solo se pueden APROBAR del 15 al 20
// de cada mes (recurrente, no depende de en qué mes se solicitaron).
export function ventanaAprobacionModificacionAbierta(fecha: string): boolean {
  return estaEnRangoDiasDelMes(fecha, 15, 20);
}
