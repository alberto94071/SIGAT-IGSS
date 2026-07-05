"use server";
import { db } from "@/lib/db";
import { consolidaciones, oferentes, siafCompras } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { crearNotificacion } from "@/lib/notificaciones";

async function requireJunta(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export async function adjudicarJunta(consolidacionId: number, data: {
  oferenteId: number; numero_adjudicacion: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireJunta();
    if ("error" in check) return check;

    const numAdj = data.numero_adjudicacion.trim();
    if (!numAdj) return { error: "La razón de adjudicación es obligatoria" };

    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.estado !== "Enviado a Junta") return { error: "Esta consolidación no está lista para adjudicar" };

    const [ofrt] = await db.select().from(oferentes)
      .where(and(eq(oferentes.id, data.oferenteId), eq(oferentes.consolidacion_id, consolidacionId))).limit(1);
    if (!ofrt) return { error: "El oferente elegido no pertenece a esta consolidación" };

    await db.update(consolidaciones).set({
      estado:               "Adjudicado",
      oferente_ganador_id:  ofrt.id,
      proveedor_id:         ofrt.proveedor_id,
      proveedor_nit:        ofrt.nit,
      proveedor_nombre:     ofrt.nombre,
      numero_adjudicacion:  numAdj,
    }).where(eq(consolidaciones.id, consolidacionId));

    await db.update(siafCompras)
      .set({ estado: "Adjudicado" })
      .where(eq(siafCompras.consolidacion_id, consolidacionId));

    return { ok: true };
  } catch {
    return { error: "Error al registrar la adjudicación" };
  }
}

export async function rechazarJunta(consolidacionId: number, motivo: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireJunta();
    if ("error" in check) return check;

    const trimmed = motivo.trim();
    if (!trimmed) return { error: "Debes indicar el motivo del rechazo" };

    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.estado !== "Enviado a Junta") return { error: "Esta consolidación no está pendiente de revisión" };

    const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
    await db.update(consolidaciones).set({
      estado:         "Rechazado por Junta",
      motivo_rechazo: trimmed,
      rechazado_por:  check.uid,
      rechazado_en:   ahora,
    }).where(eq(consolidaciones.id, consolidacionId));

    const notificarA = con.enviado_a_junta_por ?? con.creado_por;
    if (notificarA) {
      const correlativo = con.numero_adjudicacion
        ? `ADJ-${con.numero_adjudicacion}`
        : con.pre_orden ? `PRE-${con.pre_orden}` : `${con.numero}/${con.anio}`;
      await crearNotificacion({
        usuario_id:      notificarA,
        tipo:            "adjudicacion_rechazada",
        titulo:          `Consolidación ${correlativo} rechazada por Junta`,
        mensaje:         trimmed,
        ruta:            `/compras/adjudicacion?ver=${consolidacionId}`,
        referencia_tipo: "consolidaciones",
        referencia_id:   consolidacionId,
      });
    }

    return { ok: true };
  } catch {
    return { error: "Error al rechazar la consolidación" };
  }
}
