"use server";
import { db } from "@/lib/db";
import { cotizacionesServicio } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function listarCotizacionesServicio() {
  return db.select().from(cotizacionesServicio).orderBy(sql`created_at DESC`);
}

export async function crearCotizacionServicio(data: {
  fecha: string; proveedor_id: number | null; proveedor_nit: string | null;
  proveedor_nombre: string; servicio: string; costo: number; exento_iva: boolean;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };
    if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

    if (!data.proveedor_nombre.trim() || !data.servicio.trim()) return { error: "Proveedor y servicio son obligatorios" };
    if (!(data.costo > 0)) return { error: "Ingresa un costo válido" };

    await db.insert(cotizacionesServicio).values({
      fecha: data.fecha,
      proveedor_id: data.proveedor_id,
      proveedor_nit: data.proveedor_nit,
      proveedor_nombre: data.proveedor_nombre.trim(),
      servicio: data.servicio.trim(),
      costo: data.costo,
      exento_iva: data.exento_iva,
      creado_por: Number(session.user.id),
    });
    return { ok: true };
  } catch {
    return { error: "Error al registrar la cotización" };
  }
}

export async function eliminarCotizacionServicio(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };
    if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

    const [cot] = await db.select({ usado: cotizacionesServicio.usado }).from(cotizacionesServicio)
      .where(eq(cotizacionesServicio.id, id)).limit(1);
    if (!cot) return { error: "No se encontró la cotización" };
    if (cot.usado) return { error: "No se puede eliminar una cotización que ya fue usada" };

    await db.delete(cotizacionesServicio).where(eq(cotizacionesServicio.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al eliminar la cotización" };
  }
}
