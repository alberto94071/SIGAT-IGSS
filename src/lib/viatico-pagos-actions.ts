"use server";
import { db } from "@/lib/db";
import { viaticoPagos, viaticoSolicitudes, friFondoRotativo } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";

// Fase F (2026-09-08): un V-L Aprobado se vuelve un pago más de Fondo
// Rotativo — ver la nota completa en schema.ts (viaticoPagos) sobre por qué
// los viáticos siempre se tratan como grupo 100 (nunca pasan por Almacén,
// Bancos ni Caja Chica). Este archivo es el equivalente de
// fondo-rotativo-pagos-actions.ts pero para la tabla viatico_pagos —
// deliberadamente más simple porque el camino de un viático tiene muchos
// menos pasos que el de una compra.

async function requireCompras(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export type PagoViatico = {
  id: number; viatico_solicitud_id: number; total: number;
  forma_pago: string | null; numero_cheque: string | null; fecha_emision_cheque: string | null;
  destinatario_nombre: string | null; tipo_documento_pago: string | null; nit_beneficiario: string | null;
  estado: string; fri_id: number | null; fri_numero: number | null; fri_anio: number | null;
  created_at: string | null; conciliado: boolean; fecha_conciliacion: string | null;
  numero_formulario: string | null; persona_nombre: string | null;
};

export async function conDetalleViatico(rows: (typeof viaticoPagos.$inferSelect)[]): Promise<PagoViatico[]> {
  if (rows.length === 0) return [];
  const solIds = rows.map(r => r.viatico_solicitud_id);
  const friIds = rows.map(r => r.fri_id).filter((v): v is number => v != null);
  const [sols, fris] = await Promise.all([
    db.select({ id: viaticoSolicitudes.id, numero_formulario: viaticoSolicitudes.numero_formulario, persona_nombre: viaticoSolicitudes.persona_nombre })
      .from(viaticoSolicitudes).where(inArray(viaticoSolicitudes.id, solIds)),
    friIds.length > 0 ? db.select().from(friFondoRotativo).where(inArray(friFondoRotativo.id, friIds)) : Promise.resolve([]),
  ]);
  const solMap = new Map(sols.map(s => [s.id, s]));
  const friMap = new Map(fris.map(f => [f.id, f]));
  return rows.map(r => {
    const sol = solMap.get(r.viatico_solicitud_id);
    const fri = r.fri_id != null ? friMap.get(r.fri_id) : undefined;
    return {
      ...r,
      numero_formulario: sol?.numero_formulario ?? null, persona_nombre: sol?.persona_nombre ?? r.destinatario_nombre,
      fri_numero: fri?.numero ?? null, fri_anio: fri?.anio ?? null,
    };
  });
}

export async function getViaticoPagosPendientesFormaPago(): Promise<PagoViatico[]> {
  const rows = await db.select().from(viaticoPagos).where(eq(viaticoPagos.estado, "Pendiente forma de pago"));
  return conDetalleViatico(rows);
}

export async function getViaticoPagosPendientesFri(): Promise<PagoViatico[]> {
  const rows = await db.select().from(viaticoPagos).where(eq(viaticoPagos.estado, "Pendiente FRI"));
  return conDetalleViatico(rows);
}

export type TipoDocumentoPagoViatico = "Factura" | "Vale" | "Formulario";

// Los viáticos siempre se tratan como grupo 100 — elegir Cheque en Fondo
// Rotativo/Pagos pide los datos completos ahí mismo (nunca pasa por Bancos)
// y va directo a "Pendiente FRI".
export async function registrarFormaPagoChequeViatico(id: number, data: {
  numero_cheque: string; fecha_emision_cheque: string;
  tipo_documento_pago: TipoDocumentoPagoViatico; nit_beneficiario: string; destinatario_nombre: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    if (!data.numero_cheque.trim() || !data.fecha_emision_cheque)
      return { error: "No. de cheque y fecha de emisión son obligatorios" };
    if (!data.tipo_documento_pago) return { error: "Selecciona el tipo de documento" };
    if (!data.nit_beneficiario.trim()) return { error: "El NIT del beneficiario es obligatorio" };
    if (!data.destinatario_nombre.trim()) return { error: "El nombre del beneficiario es obligatorio" };

    const [pago] = await db.select({ estado: viaticoPagos.estado }).from(viaticoPagos).where(eq(viaticoPagos.id, id)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Pendiente forma de pago") return { error: "Este registro ya tiene forma de pago asignada" };

    await db.update(viaticoPagos).set({
      forma_pago: "cheque",
      numero_cheque: data.numero_cheque.trim(),
      fecha_emision_cheque: data.fecha_emision_cheque,
      tipo_documento_pago: data.tipo_documento_pago,
      nit_beneficiario: data.nit_beneficiario.trim(),
      destinatario_nombre: data.destinatario_nombre.trim(),
      estado: "Pendiente FRI",
    }).where(eq(viaticoPagos.id, id));

    return { ok: true };
  } catch {
    return { error: "Error al registrar el pago con cheque" };
  }
}

// Elegir Efectivo tampoco pasa por Caja Chica/Vale (eso es solo para
// renglones 200/300) — va directo a "Pendiente FRI".
export async function registrarFormaPagoEfectivoViatico(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [pago] = await db.select({ estado: viaticoPagos.estado }).from(viaticoPagos).where(eq(viaticoPagos.id, id)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Pendiente forma de pago") return { error: "Este registro ya tiene forma de pago asignada" };

    await db.update(viaticoPagos).set({ forma_pago: "efectivo", estado: "Pendiente FRI" }).where(eq(viaticoPagos.id, id));

    return { ok: true };
  } catch {
    return { error: "Error al registrar el pago en efectivo" };
  }
}

// Por si se eligió mal la forma de pago — regresa a "Pendiente forma de
// pago" para volver a elegir. Solo mientras siga "Pendiente FRI" (todavía no
// se conformó ningún FRI con este registro) y el cheque, si lo hay, no esté
// conciliado.
export async function devolverAFormaPagoViatico(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [pago] = await db.select().from(viaticoPagos).where(eq(viaticoPagos.id, id)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Pendiente FRI") return { error: "Este pago ya no está pendiente de FRI — ya no se puede devolver" };
    if (pago.conciliado) return { error: "Este cheque ya fue conciliado con el banco — ya no se puede devolver" };

    await db.update(viaticoPagos).set({
      forma_pago: null, estado: "Pendiente forma de pago",
      numero_cheque: null, fecha_emision_cheque: null, tipo_documento_pago: null,
    }).where(eq(viaticoPagos.id, id));

    return { ok: true };
  } catch {
    return { error: "Error al devolver el pago" };
  }
}

export async function marcarConciliadoViatico(pagoId: number, fecha: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    if (!fecha.trim()) return { error: "La fecha de conciliación es obligatoria" };
    await db.update(viaticoPagos).set({ conciliado: true, fecha_conciliacion: fecha.trim() }).where(eq(viaticoPagos.id, pagoId));
    return { ok: true };
  } catch {
    return { error: "Error al marcar como conciliado" };
  }
}

export async function desmarcarConciliadoViatico(pagoId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    await db.update(viaticoPagos).set({ conciliado: false, fecha_conciliacion: null }).where(eq(viaticoPagos.id, pagoId));
    return { ok: true };
  } catch {
    return { error: "Error al desmarcar" };
  }
}
