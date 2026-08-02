export const GRUPOS = [
  { id: 1, label: "100 - 199", min: 100, max: 199 },
  { id: 2, label: "200 - 299", min: 200, max: 299 },
  { id: 3, label: "300 - 399", min: 300, max: 399 },
] as const;

export const CUATRIMESTRES = [
  { id: 1, label: "Enero - Abril", meses: ["Enero", "Febrero", "Marzo", "Abril"] },
  { id: 2, label: "Mayo - Agosto", meses: ["Mayo", "Junio", "Julio", "Agosto"] },
  { id: 3, label: "Septiembre - Diciembre", meses: ["Septiembre", "Octubre", "Noviembre", "Diciembre"] },
] as const;

// Cuatrimestre (1/2/3) al que pertenece una fecha "YYYY-MM-DD".
export function cuatrimestreDeFecha(fecha: string): number {
  const mes = Number(fecha.slice(5, 7));
  if (mes <= 4) return 1;
  if (mes <= 8) return 2;
  return 3;
}

export function grupoDeRenglon(renglon: number) {
  return GRUPOS.find(g => renglon >= g.min && renglon <= g.max) ?? null;
}

// Pipeline Compromiso → [Almacén/DAB-60] → Devengado: los renglones de los
// grupos 200-299 y 300-399 son insumos que pasan por Almacén, EXCEPTO estos
// tres (servicios, no hay nada físico que recibir en bodega) que van directo
// de Compromiso a Devengado.
const RENGLONES_SIN_DAB60 = [261, 266, 295];

export function requiereDab60(renglon: number | null | undefined): boolean {
  if (renglon == null) return false;
  if (RENGLONES_SIN_DAB60.includes(renglon)) return false;
  const grupo = grupoDeRenglon(renglon);
  return grupo?.id === 2 || grupo?.id === 3;
}

// Fondo Rotativo/Pagos: los renglones 100-199 no pasan por Bancos ni Caja
// Chica/Vale — se agrupan en Pago/FRI (Formulario de Reintegro Interno).
export function esGrupo100(renglon: number | null | undefined): boolean {
  if (renglon == null) return false;
  return grupoDeRenglon(renglon)?.id === 1;
}

// Reprogramación: tipos de modificación presupuestaria de valor libre (sin
// contrapartida) — cada uno escribe en su propia columna de
// presupuesto_renglones (ver ejecucion-actions.ts). La transferencia real
// entre renglón/sub-producto (con origen, destino y validación de saldo) es
// un flujo aparte — ver transferirPresupuesto en programacion-actions.ts.
export const TIPOS_MODIFICACION = [
  { id: "ingru",      label: "Modificación tipo Ingru", campo: "modificacion_ingru" },
  { id: "ampliacion", label: "Modificación Ampliación", campo: "modificacion_ampliacion" },
] as const;

export type TipoModificacion = typeof TIPOS_MODIFICACION[number]["id"];
