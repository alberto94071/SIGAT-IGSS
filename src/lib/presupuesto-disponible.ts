import { db } from "@/lib/db";
import { programacionEntradas, presupuestoRenglones } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";

// Mismo ejercicio fiscal hardcodeado que usa el resto del módulo de
// Presupuesto (programacion-actions.ts, ejecucion-actions.ts,
// compromiso-actions.ts, devengado-actions.ts, a01-siaf/actions.ts) — no hay
// selector de año en la UI todavía.
export const EJERCICIO_FISCAL = 2026;

export type Disponible = {
  programado: number;
  modificaciones: number;
  usado: number;
  disponible: number;
};

// Presupuesto real disponible de un renglón+sub-producto: lo programado en
// Programación (los 4 meses de los 3 cuatrimestres, Normal + Regularizado
// sumados — a la fecha de aprobar un SIAF todavía no se sabe si terminará
// siendo Normal o Regularizado) más las modificaciones presupuestarias
// (Ingru + transferencias + Ampliación), menos lo que ya está reservado o
// ejecutado en cualquier etapa (Pre-Compromiso, Compromiso, Devengado).
export async function getDisponible(renglon: number, subproducto: string): Promise<Disponible> {
  const [entradasRow] = await db.select({
    total: sql<number>`COALESCE(SUM(${programacionEntradas.mes1} + ${programacionEntradas.mes2} + ${programacionEntradas.mes3} + ${programacionEntradas.mes4}), 0)`,
  }).from(programacionEntradas).where(and(
    eq(programacionEntradas.ejercicio_fiscal, EJERCICIO_FISCAL),
    eq(programacionEntradas.renglon, renglon),
    eq(programacionEntradas.subproducto, subproducto),
  ));
  const programado = Number(entradasRow?.total ?? 0);

  const [vivo] = await db.select({
    modificacion_ingru:           presupuestoRenglones.modificacion_ingru,
    modificacion_entre_renglones: presupuestoRenglones.modificacion_entre_renglones,
    modificacion_ampliacion:      presupuestoRenglones.modificacion_ampliacion,
    pre_compromiso:               presupuestoRenglones.pre_compromiso,
    compromiso:                   presupuestoRenglones.compromiso,
    devengado:                    presupuestoRenglones.devengado,
    devengado_regularizado:       presupuestoRenglones.devengado_regularizado,
  }).from(presupuestoRenglones).where(and(
    eq(presupuestoRenglones.renglon, renglon),
    eq(presupuestoRenglones.subproducto, subproducto),
    eq(presupuestoRenglones.ejercicio_fiscal, EJERCICIO_FISCAL),
  )).limit(1);

  const modificaciones =
    (vivo?.modificacion_ingru ?? 0) + (vivo?.modificacion_entre_renglones ?? 0) + (vivo?.modificacion_ampliacion ?? 0);
  const usado =
    (vivo?.pre_compromiso ?? 0) + (vivo?.compromiso ?? 0) + (vivo?.devengado ?? 0) + (vivo?.devengado_regularizado ?? 0);

  return { programado, modificaciones, usado, disponible: programado + modificaciones - usado };
}

export type RenglonSubproducto = { renglon: number; subproducto: string; monto: number };
export type PresupuestoExcedido = { renglon: number; subproducto: string; disponible: number; requerido: number };

// Verifica un lote de {renglon, subproducto, monto} contra el presupuesto
// disponible real, agrupando por renglón+sub-producto (varias líneas del
// mismo renglón/sub-producto se suman entre sí antes de comparar). Devuelve
// el detalle de los que excederían el disponible.
export async function verificarPresupuestoDisponible(items: RenglonSubproducto[]): Promise<PresupuestoExcedido[]> {
  const porClave = new Map<string, RenglonSubproducto>();
  for (const item of items) {
    const key = `${item.renglon}::${item.subproducto}`;
    const existente = porClave.get(key);
    if (existente) existente.monto += item.monto;
    else porClave.set(key, { ...item });
  }

  const excedidos: PresupuestoExcedido[] = [];
  for (const { renglon, subproducto, monto } of porClave.values()) {
    const { disponible } = await getDisponible(renglon, subproducto);
    if (monto > disponible + 0.01) excedidos.push({ renglon, subproducto, disponible, requerido: monto });
  }
  return excedidos;
}

export async function mensajePresupuestoExcedido(excedidos: PresupuestoExcedido[]): Promise<string> {
  const detalle = excedidos.map(e =>
    `renglón ${e.renglon} / ${e.subproducto} (disponible Q${e.disponible.toLocaleString("es-GT", { minimumFractionDigits: 2 })}, se necesitan Q${e.requerido.toLocaleString("es-GT", { minimumFractionDigits: 2 })})`
  ).join("; ");
  return `No hay presupuesto programado suficiente para: ${detalle}. Ve a Presupuesto/Programación para programar o reprogramar antes de aprobar.`;
}
