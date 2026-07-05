"use server";
import { db } from "@/lib/db";
import { actasAdjudicacion, consolidaciones } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { crearNotificacion } from "@/lib/notificaciones";

async function requireJunta(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export async function getActasPendientes() {
  const cons = await db.select().from(consolidaciones).where(eq(consolidaciones.estado, "Adjudicado"));
  if (cons.length === 0) return [];

  const actas = await db.select().from(actasAdjudicacion);
  const actasMap = new Map(actas.map(a => [a.consolidacion_id, a]));

  return cons.map(c => ({ consolidacion: c, acta: actasMap.get(c.id) ?? null }));
}

export async function generarActa(consolidacionId: number, data: {
  no_formulario: string; no_acta: string; lugar: string; fecha: string; hora: string;
}): Promise<{ acta: typeof actasAdjudicacion.$inferSelect } | { error: string }> {
  try {
    const check = await requireJunta();
    if ("error" in check) return check;

    if (!data.no_formulario.trim()) return { error: "El No. de Formulario es obligatorio" };
    if (!data.no_acta.trim()) return { error: "El No. de Acta es obligatorio" };
    if (!data.lugar.trim()) return { error: "El lugar es obligatorio" };
    if (!data.fecha.trim()) return { error: "La fecha es obligatoria" };
    if (!data.hora.trim()) return { error: "La hora es obligatoria" };

    const [con] = await db.select({ estado: consolidaciones.estado }).from(consolidaciones)
      .where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.estado !== "Adjudicado") return { error: "Solo se puede generar acta de una consolidación Adjudicada" };

    // Si ya existe un acta (p. ej. una rechazada que se está corrigiendo), se reemplaza
    await db.delete(actasAdjudicacion).where(eq(actasAdjudicacion.consolidacion_id, consolidacionId));

    const [acta] = await db.insert(actasAdjudicacion).values({
      consolidacion_id: consolidacionId,
      no_formulario: data.no_formulario.trim(),
      no_acta: data.no_acta.trim(),
      lugar: data.lugar.trim(),
      fecha: data.fecha,
      hora: data.hora,
      generado_por: check.uid,
    }).returning();

    return { acta };
  } catch {
    return { error: "Error al generar el acta" };
  }
}

export async function marcarActaPrevisualizada(actaId: number): Promise<{ ok: true } | { error: string }> {
  try {
    await db.update(actasAdjudicacion).set({ previsualizada: true }).where(eq(actasAdjudicacion.id, actaId));
    return { ok: true };
  } catch {
    return { error: "Error al marcar el acta como previsualizada" };
  }
}

export async function aprobarActa(actaId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireJunta();
    if ("error" in check) return check;

    const [acta] = await db.select().from(actasAdjudicacion).where(eq(actasAdjudicacion.id, actaId)).limit(1);
    if (!acta) return { error: "No se encontró el acta" };
    if (!acta.previsualizada) return { error: "Debes previsualizar el acta antes de aprobarla" };
    if (acta.estado !== "Generada") return { error: "Esta acta ya fue procesada" };

    const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
    await db.update(actasAdjudicacion).set({
      estado: "Aprobada", aprobado_por: check.uid, aprobado_en: ahora,
    }).where(eq(actasAdjudicacion.id, actaId));

    await db.update(consolidaciones).set({ acta_aprobada: true }).where(eq(consolidaciones.id, acta.consolidacion_id));

    return { ok: true };
  } catch {
    return { error: "Error al aprobar el acta" };
  }
}

export async function rechazarActa(actaId: number, motivo: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireJunta();
    if ("error" in check) return check;

    const trimmed = motivo.trim();
    if (!trimmed) return { error: "Debes indicar el motivo del rechazo" };

    const [acta] = await db.select().from(actasAdjudicacion).where(eq(actasAdjudicacion.id, actaId)).limit(1);
    if (!acta) return { error: "No se encontró el acta" };
    if (!acta.previsualizada) return { error: "Debes previsualizar el acta antes de rechazarla" };
    if (acta.estado !== "Generada") return { error: "Esta acta ya fue procesada" };

    const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
    await db.update(actasAdjudicacion).set({
      estado: "Rechazada", motivo_rechazo: trimmed, rechazado_por: check.uid, rechazado_en: ahora,
    }).where(eq(actasAdjudicacion.id, actaId));

    if (acta.generado_por) {
      await crearNotificacion({
        usuario_id:      acta.generado_por,
        tipo:            "acta_rechazada",
        titulo:          `Acta ${acta.no_acta} rechazada`,
        mensaje:         trimmed,
        ruta:            `/junta-adjudicadora/acta`,
        referencia_tipo: "actas_adjudicacion",
        referencia_id:   actaId,
      });
    }

    return { ok: true };
  } catch {
    return { error: "Error al rechazar el acta" };
  }
}
