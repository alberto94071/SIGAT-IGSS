"use server";
import { db } from "@/lib/db";
import { fondoRotativoPagos, consolidaciones, valesCajaChica } from "@/lib/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

async function requireCompras(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export type PagoFondoRotativo = {
  id: number; consolidacion_id: number;
  no_factura: string; serie_factura: string; fecha_emision_factura: string;
  forma_pago: string | null; numero_cheque: string | null; fecha_emision_cheque: string | null;
  destinatario_nombre: string | null; fecha_pago: string | null; numero_vale: string | null;
  vale_id: number | null; vale_solicitante_nombre: string | null;
  estado: string;
  numero_a04: number | null; anio_a04: number | null;
  total: number | null; tipo_compra: string | null;
};

export async function conDetalle(rows: (typeof fondoRotativoPagos.$inferSelect)[]): Promise<PagoFondoRotativo[]> {
  if (rows.length === 0) return [];
  const consIds = rows.map(r => r.consolidacion_id);
  const valeIds = rows.map(r => r.vale_id).filter((v): v is number => v != null);
  const [cons, vales] = await Promise.all([
    db.select().from(consolidaciones).where(inArray(consolidaciones.id, consIds)),
    valeIds.length > 0
      ? db.select().from(valesCajaChica).where(inArray(valesCajaChica.id, valeIds))
      : Promise.resolve([]),
  ]);
  const consMap = new Map(cons.map(c => [c.id, c]));
  const valeMap = new Map(vales.map(v => [v.id, v]));
  return rows.map(r => {
    const c = consMap.get(r.consolidacion_id);
    const vale = r.vale_id != null ? valeMap.get(r.vale_id) : undefined;
    return {
      ...r,
      numero_a04: c?.numero_a04 ?? null, anio_a04: c?.anio_a04 ?? null,
      total: c?.total ?? null, tipo_compra: c?.tipo_compra ?? null,
      vale_solicitante_nombre: vale?.solicitante_nombre ?? null,
    };
  });
}

export async function getPagosPendientesFormaPago(): Promise<PagoFondoRotativo[]> {
  const rows = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.estado, "Pendiente forma de pago"));
  return conDetalle(rows);
}

export async function getLibroBancos(): Promise<PagoFondoRotativo[]> {
  const rows = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.estado, "Enviado a Bancos"));
  return conDetalle(rows);
}

// Historial completo de Fondo Rotativo — toda consolidación que ya generó su
// SIAF-04, sin importar en qué parte del flujo (Pagos, Bancos, Liquidación o
// Libro Caja Chica) haya quedado. Aquí solo se puede volver a ver/imprimir el SIAF-04.
export async function getArchivoFondoRotativo(): Promise<PagoFondoRotativo[]> {
  const rows = await db.select().from(fondoRotativoPagos).orderBy(sql`id DESC`);
  return conDetalle(rows);
}

export async function registrarFormaPagoCheque(id: number, data: {
  numero_cheque: string; fecha_emision_cheque: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    if (!data.numero_cheque.trim() || !data.fecha_emision_cheque)
      return { error: "No. de cheque y fecha de emisión son obligatorios" };

    const [pago] = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, id)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Pendiente forma de pago") return { error: "Este registro ya tiene forma de pago asignada" };

    await db.update(fondoRotativoPagos).set({
      forma_pago: "cheque",
      numero_cheque: data.numero_cheque.trim(),
      fecha_emision_cheque: data.fecha_emision_cheque,
      estado: "Enviado a Bancos",
    }).where(eq(fondoRotativoPagos.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al registrar el pago con cheque" };
  }
}

// El pago en efectivo se liga a un vale REAL generado en Caja Chica/Vale (no
// texto libre) — el vale debe estar "Pendiente" (todavía no usado en otro
// pago). Al confirmar, el pago pasa a Fondo Rotativo → Caja Chica/Liquidación
// (no a un "Libro Caja Chica" propio de Fondo Rotativo, que ya no existe) y el
// vale se marca "Usado" para que no se pueda volver a elegir.
export async function registrarFormaPagoEfectivo(id: number, data: {
  fecha_pago: string; vale_id: number;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    if (!data.fecha_pago || !data.vale_id)
      return { error: "Fecha de pago y vale son obligatorios" };

    const [pago] = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, id)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Pendiente forma de pago") return { error: "Este registro ya tiene forma de pago asignada" };

    const [vale] = await db.select().from(valesCajaChica).where(eq(valesCajaChica.id, data.vale_id)).limit(1);
    if (!vale) return { error: "No se encontró el vale seleccionado" };
    if (vale.estado !== "Pendiente") return { error: "Ese vale ya fue usado en otro pago" };

    await db.update(fondoRotativoPagos).set({
      forma_pago: "efectivo",
      fecha_pago: data.fecha_pago,
      numero_vale: String(vale.numero).padStart(7, "0"),
      vale_id: vale.id,
      estado: "Enviado a Liquidación",
    }).where(eq(fondoRotativoPagos.id, id));

    await db.update(valesCajaChica).set({ estado: "Usado" }).where(eq(valesCajaChica.id, vale.id));

    return { ok: true };
  } catch {
    return { error: "Error al registrar el pago en efectivo" };
  }
}
