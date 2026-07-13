"use server";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { parsePreferencias, DEFAULT_PREFERENCIAS, type PreferenciasUI } from "@/lib/preferencias";

export async function getMisPreferenciasUI(): Promise<PreferenciasUI> {
  const session = await auth();
  if (!session) return { ...DEFAULT_PREFERENCIAS };
  const [row] = await db.select({ preferencias_ui: usuarios.preferencias_ui })
    .from(usuarios).where(eq(usuarios.id, Number(session.user.id))).limit(1);
  return parsePreferencias(row?.preferencias_ui);
}

export async function guardarPreferenciasUI(prefs: PreferenciasUI): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };

    // parsePreferencias valida y descarta cualquier valor inválido (hex mal
    // formado, tema desconocido, etc.) antes de persistir.
    const limpias = parsePreferencias(JSON.stringify(prefs));
    await db.update(usuarios)
      .set({ preferencias_ui: JSON.stringify(limpias) })
      .where(eq(usuarios.id, Number(session.user.id)));
    return { ok: true };
  } catch {
    return { error: "Error al guardar las preferencias" };
  }
}
