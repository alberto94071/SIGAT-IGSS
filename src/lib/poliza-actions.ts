"use server";
import { fechaGuatemala } from "@/lib/date-utils";

import { db } from "@/lib/db";
import { polizas, pasajesPagos } from "@/lib/schema";
import { eq, desc, inArray, sql, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getValeActivo } from "@/lib/vale-actions";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export async function listarPolizas() {
  return db.select().from(polizas).orderBy(desc(polizas.numero));
}

export async function getPolizaConDetalle(id: number) {
  const [poliza] = await db.select().from(polizas).where(eq(polizas.id, id)).limit(1);
  if (!poliza) return null;
  const items = await db.select().from(pasajesPagos).where(eq(pasajesPagos.poliza_id, id)).orderBy(pasajesPagos.formulario_no);
  return { poliza, items };
}

export async function getPolizaPorNumero(numero: number) {
  const [poliza] = await db.select().from(polizas).where(eq(polizas.numero, numero)).limit(1);
  if (!poliza) return null;
  const items = await db.select().from(pasajesPagos).where(eq(pasajesPagos.poliza_id, poliza.id)).orderBy(pasajesPagos.formulario_no);
  return { poliza, items };
}

// DPD-23 generados que todavía no forman parte de ninguna póliza.
export async function listarDpd23SinPoliza() {
  return db.select().from(pasajesPagos)
    .where(sql`${pasajesPagos.poliza_id} IS NULL`)
    .orderBy(desc(pasajesPagos.formulario_no));
}

export async function generarPoliza(dpd23Ids: number[]): Promise<{ ok: true; numero: number } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (dpd23Ids.length === 0) return { error: "Selecciona al menos un DPD-23" };

    const items = await db.select().from(pasajesPagos).where(inArray(pasajesPagos.id, dpd23Ids));
    if (items.length !== dpd23Ids.length) return { error: "Alguno de los DPD-23 seleccionados no existe" };
    if (items.some(i => i.poliza_id != null)) return { error: "Alguno de los DPD-23 seleccionados ya pertenece a otra póliza" };

    const total = items.reduce((s, i) => s + i.valor_pasaje, 0);
    const res = await db.execute(sql`SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM polizas`);
    const numero = Number((res.rows[0] as any).next) || 1;

    const [poliza] = await db.insert(polizas).values({
      numero, fecha: fechaGuatemala(), total, creado_por: check.uid,
    }).returning();

    await db.update(pasajesPagos).set({ poliza_id: poliza.id }).where(inArray(pasajesPagos.id, dpd23Ids));

    return { ok: true, numero };
  } catch {
    return { error: "Error al generar la póliza" };
  }
}

// Asigna el vale de pasajes activo a varias pólizas "Generada" y las envía a
// liquidar en un solo paso — así lo describe el flujo real (un solo diálogo).
export async function asignarValeYEnviarALiquidar(polizaIds: number[]): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (polizaIds.length === 0) return { error: "Selecciona al menos una póliza" };

    const vale = await getValeActivo("pasajes");
    if (!vale) return { error: "No hay un vale de pago de pasajes activo. Debes generarlo primero en Caja Chica/Vale." };
    if (vale.estado !== "Activo") return { error: "El vale de pasajes todavía no tiene cheque asignado" };

    const seleccionadas = await db.select().from(polizas).where(inArray(polizas.id, polizaIds));
    if (seleccionadas.length !== polizaIds.length) return { error: "Alguna de las pólizas seleccionadas no existe" };
    if (seleccionadas.some(p => p.estado !== "Generada")) return { error: "Alguna de las pólizas seleccionadas ya tiene un vale asignado" };

    const yaAsignadas = await db.select().from(polizas)
      .where(and(eq(polizas.vale_id, vale.id), inArray(polizas.estado, ["Enviada a Liquidar"])));
    const totalYaAsignado = yaAsignadas.reduce((s, p) => s + p.total, 0);
    const totalSeleccion = seleccionadas.reduce((s, p) => s + p.total, 0);
    const montoVale = vale.monto_autorizado ?? vale.monto;

    if (totalYaAsignado + totalSeleccion > montoVale) {
      return { error: `La suma de las pólizas (Q${(totalYaAsignado + totalSeleccion).toFixed(2)}) supera el monto del vale (Q${montoVale.toFixed(2)})` };
    }

    await db.update(polizas).set({ vale_id: vale.id, estado: "Enviada a Liquidar" }).where(inArray(polizas.id, polizaIds));

    return { ok: true };
  } catch {
    return { error: "Error al asignar el vale" };
  }
}
