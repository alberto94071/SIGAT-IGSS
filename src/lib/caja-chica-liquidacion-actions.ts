"use server";
import { db } from "@/lib/db";
import { fondoRotativoPagos } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { conDetalle, type PagoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

// Pagos en efectivo que llegaron de Fondo Rotativo/Pagos y todavía no se han
// liquidado contra su vale de Caja Chica.
export async function getLiquidacionesPendientes(): Promise<PagoFondoRotativo[]> {
  const rows = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.estado, "Enviado a Liquidación"));
  return conDetalle(rows);
}

export async function liquidarPago(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    const [pago] = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, id)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Enviado a Liquidación") return { error: "Este pago no está pendiente de liquidar" };

    await db.update(fondoRotativoPagos).set({ estado: "Liquidado" }).where(eq(fondoRotativoPagos.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al liquidar el pago" };
  }
}

// Libro de Caja Chica — pagos en efectivo ya liquidados.
export async function getLibroCajaChica(): Promise<PagoFondoRotativo[]> {
  const rows = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.estado, "Liquidado"));
  return conDetalle(rows);
}
