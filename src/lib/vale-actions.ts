"use server";
import { fechaGuatemala } from "@/lib/date-utils";

import { db } from "@/lib/db";
import { valesCajaChica, configuracion, polizas, fondoRotativoPagos, consolidaciones } from "@/lib/schema";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export type TipoVale = "pasajes" | "gastos_varios";
const ESTADOS_ACTIVOS = ["Pendiente autorización", "Autorizado", "Activo"];

async function getConfig() {
  const [config] = await db.select().from(configuracion).limit(1);
  return config;
}

// ─── Saldo del Fondo Rotativo ─────────────────────────────────────────────────
export async function getSaldoFondoRotativo() {
  const config = await getConfig();
  return {
    monto_fondo_rotativo: config?.monto_fondo_rotativo ?? 0,
    saldo_disponible: config?.efectivo_caja ?? 0,
  };
}

// ─── Creación del vale (Caja Chica) ───────────────────────────────────────────
export type NuevoValeData = { tipo: TipoVale; monto: number; motivo: string };

export async function crearVale(data: NuevoValeData): Promise<{ vale: typeof valesCajaChica.$inferSelect } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    if (!(data.monto > 0)) return { error: "Ingresa un monto válido" };
    if (!data.motivo.trim()) return { error: "La justificación es obligatoria" };

    const [activo] = await db.select().from(valesCajaChica)
      .where(and(eq(valesCajaChica.tipo, data.tipo), inArray(valesCajaChica.estado, ESTADOS_ACTIVOS)))
      .limit(1);
    if (activo) {
      return { error: `Ya existe un vale de ${data.tipo === "pasajes" ? "pago de pasajes" : "gastos varios"} activo (No. ${String(activo.numero).padStart(7, "0")}). Debes liquidarlo antes de generar uno nuevo.` };
    }

    const config = await getConfig();
    if (!config) return { error: "No se encontró la configuración del sistema" };

    const res = await db.execute(sql`SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM vales_caja_chica WHERE tipo = ${data.tipo}`);
    const numero = Number((res.rows[0] as any).next) || 1;

    const [vale] = await db.insert(valesCajaChica).values({
      numero, tipo: data.tipo,
      fecha: fechaGuatemala(),
      monto: data.monto, motivo: data.motivo.trim(),
      solicitante_nombre: config.nombre_solicitante, solicitante_numero_empleado: config.numero_empleado_sol, solicitante_nit: config.nit_solicitante,
      jefe_nombre: config.nombre_encargado_unidad, jefe_numero_empleado: config.numero_empleado_encargado, jefe_nit: config.nit_encargado_unidad,
      estado: "Pendiente autorización",
      creado_por: check.uid,
    }).returning();

    return { vale };
  } catch {
    return { error: "Error al registrar el vale" };
  }
}

export async function getVales() {
  return db.select().from(valesCajaChica).orderBy(desc(valesCajaChica.id));
}

export async function getValeActivo(tipo: TipoVale) {
  const [vale] = await db.select().from(valesCajaChica)
    .where(and(eq(valesCajaChica.tipo, tipo), inArray(valesCajaChica.estado, ESTADOS_ACTIVOS)))
    .orderBy(desc(valesCajaChica.id)).limit(1);
  return vale ?? null;
}

// Vale de gastos varios ya con cheque asignado — el único que se puede elegir
// al registrar un pago en efectivo en Fondo Rotativo/Pagos.
export async function getValesGastosVariosDisponibles() {
  const vale = await getValeActivo("gastos_varios");
  if (!vale || vale.estado !== "Activo") return [];
  return [{ id: vale.id, numero: vale.numero, monto: vale.monto_autorizado ?? vale.monto, solicitante_nombre: vale.solicitante_nombre }];
}

// ─── Autorización (Fondo Rotativo) ───────────────────────────────────────────
export async function getValesPendientesAutorizacion() {
  return db.select().from(valesCajaChica)
    .where(eq(valesCajaChica.estado, "Pendiente autorización"))
    .orderBy(desc(valesCajaChica.id));
}

export async function autorizarVale(id: number, montoAutorizado: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (!(montoAutorizado > 0)) return { error: "Ingresa un monto autorizado válido" };

    const [vale] = await db.select().from(valesCajaChica).where(eq(valesCajaChica.id, id)).limit(1);
    if (!vale) return { error: "No se encontró el vale" };
    if (vale.estado !== "Pendiente autorización") return { error: "Este vale ya fue procesado" };

    const config = await getConfig();
    const saldo = config?.efectivo_caja ?? 0;
    if (montoAutorizado > saldo) return { error: `El monto autorizado no puede superar el saldo disponible del Fondo Rotativo (Q${saldo.toFixed(2)})` };

    await db.update(valesCajaChica).set({ estado: "Autorizado", monto_autorizado: montoAutorizado }).where(eq(valesCajaChica.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al autorizar el vale" };
  }
}

export async function rechazarVale(id: number, motivo: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (!motivo.trim()) return { error: "El motivo del rechazo es obligatorio" };

    const [vale] = await db.select().from(valesCajaChica).where(eq(valesCajaChica.id, id)).limit(1);
    if (!vale) return { error: "No se encontró el vale" };
    if (vale.estado !== "Pendiente autorización") return { error: "Este vale ya fue procesado" };

    await db.update(valesCajaChica).set({ estado: "Rechazado", motivo_rechazo: motivo.trim() }).where(eq(valesCajaChica.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al rechazar el vale" };
  }
}

// ─── Asignación de cheque (Fondo Rotativo) — genera el Voucher ──────────────
export async function asignarChequeVale(id: number, data: { numero_cheque: string; destinatario_cheque: string }): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (!data.numero_cheque.trim()) return { error: "El número de cheque es obligatorio" };
    if (!data.destinatario_cheque.trim()) return { error: "El nombre del destinatario del cheque es obligatorio" };

    const [vale] = await db.select().from(valesCajaChica).where(eq(valesCajaChica.id, id)).limit(1);
    if (!vale) return { error: "No se encontró el vale" };
    if (vale.estado !== "Autorizado") return { error: "Este vale todavía no ha sido autorizado" };

    const monto = vale.monto_autorizado ?? vale.monto;

    await db.update(valesCajaChica).set({
      numero_cheque: data.numero_cheque.trim(),
      destinatario_cheque: data.destinatario_cheque.trim(),
      fecha_emision: fechaGuatemala(),
      estado: "Activo",
    }).where(eq(valesCajaChica.id, id));

    await db.update(configuracion).set({ efectivo_caja: sql`${configuracion.efectivo_caja} - ${monto}` });

    return { ok: true };
  } catch {
    return { error: "Error al asignar el cheque" };
  }
}

// ─── Voucher — cheques ya generados ───────────────────────────────────────────
export async function getVouchers() {
  return db.select().from(valesCajaChica)
    .where(sql`${valesCajaChica.numero_cheque} IS NOT NULL`)
    .orderBy(desc(valesCajaChica.id));
}

export async function getVoucher(id: number) {
  const [vale] = await db.select().from(valesCajaChica).where(eq(valesCajaChica.id, id)).limit(1);
  return vale ?? null;
}

// ─── Liquidación ──────────────────────────────────────────────────────────────
export async function getUsoValePasajes(valeId: number) {
  const pendientes = await db.select().from(polizas)
    .where(and(eq(polizas.vale_id, valeId), eq(polizas.estado, "Enviada a Liquidar")));
  return { total: pendientes.reduce((s, p) => s + p.total, 0), polizas: pendientes };
}

export async function liquidarValePasajes(valeId: number, data: { numero_boleta_deposito?: string; monto_boleta_deposito?: number }): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    const [vale] = await db.select().from(valesCajaChica).where(eq(valesCajaChica.id, valeId)).limit(1);
    if (!vale) return { error: "No se encontró el vale" };
    if (vale.tipo !== "pasajes") return { error: "Este vale no es de pago de pasajes" };
    if (vale.estado !== "Activo") return { error: "Este vale no está activo" };

    const pendientes = await db.select().from(polizas)
      .where(and(eq(polizas.vale_id, valeId), eq(polizas.estado, "Enviada a Liquidar")));
    const totalUsado = pendientes.reduce((s, p) => s + p.total, 0);
    const monto = vale.monto_autorizado ?? vale.monto;
    const remanente = monto - totalUsado;

    if (remanente > 0.009) {
      if (!data.numero_boleta_deposito?.trim() || !(data.monto_boleta_deposito! > 0))
        return { error: `Debes ingresar el número de boleta de depósito por el remanente (Q${remanente.toFixed(2)})` };
      if (Math.abs(data.monto_boleta_deposito! - remanente) > 0.01)
        return { error: `El monto de la boleta debe ser exactamente el remanente (Q${remanente.toFixed(2)})` };
    }

    await db.update(valesCajaChica).set({
      estado: "Liquidado",
      monto_liquidado: totalUsado,
      fecha_liquidacion: fechaGuatemala(),
      numero_boleta_deposito: data.numero_boleta_deposito?.trim() || null,
      monto_boleta_deposito: remanente > 0.009 ? data.monto_boleta_deposito : null,
    }).where(eq(valesCajaChica.id, valeId));

    if (pendientes.length > 0) {
      await db.update(polizas).set({ estado: "Liquidada" })
        .where(inArray(polizas.id, pendientes.map(p => p.id)));
    }

    if (remanente > 0.009) {
      await db.update(configuracion).set({ efectivo_caja: sql`${configuracion.efectivo_caja} + ${data.monto_boleta_deposito}` });
    }

    return { ok: true };
  } catch {
    return { error: "Error al liquidar el vale" };
  }
}

// El total usado se calcula solo, sumando las consolidaciones de los pagos en
// efectivo ya ligados a este vale desde Fondo Rotativo/Pagos (igual que en
// pasajes) — no se vuelve a teclear a mano.
export async function getUsoValeGastosVarios(valeId: number) {
  const rows = await db.select({ total: consolidaciones.total })
    .from(fondoRotativoPagos)
    .innerJoin(consolidaciones, eq(fondoRotativoPagos.consolidacion_id, consolidaciones.id))
    .where(eq(fondoRotativoPagos.vale_id, valeId));
  return rows.reduce((s, r) => s + (r.total ?? 0), 0);
}

export async function liquidarValeGastosVarios(valeId: number, data: { numero_boleta_deposito?: string; monto_boleta_deposito?: number }): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    const [vale] = await db.select().from(valesCajaChica).where(eq(valesCajaChica.id, valeId)).limit(1);
    if (!vale) return { error: "No se encontró el vale" };
    if (vale.tipo !== "gastos_varios") return { error: "Este vale no es de gastos varios" };
    if (vale.estado !== "Activo") return { error: "Este vale no está activo" };

    const totalUsado = await getUsoValeGastosVarios(valeId);
    const monto = vale.monto_autorizado ?? vale.monto;
    const remanente = monto - totalUsado;

    if (remanente > 0.009) {
      if (!data.numero_boleta_deposito?.trim() || !(data.monto_boleta_deposito! > 0))
        return { error: `Debes ingresar el número de boleta de depósito por el remanente (Q${remanente.toFixed(2)})` };
      if (Math.abs(data.monto_boleta_deposito! - remanente) > 0.01)
        return { error: `El monto de la boleta debe ser exactamente el remanente (Q${remanente.toFixed(2)})` };
    }

    await db.update(valesCajaChica).set({
      estado: "Liquidado",
      monto_liquidado: totalUsado,
      fecha_liquidacion: fechaGuatemala(),
      numero_boleta_deposito: data.numero_boleta_deposito?.trim() || null,
      monto_boleta_deposito: remanente > 0.009 ? data.monto_boleta_deposito : null,
    }).where(eq(valesCajaChica.id, valeId));

    if (remanente > 0.009) {
      await db.update(configuracion).set({ efectivo_caja: sql`${configuracion.efectivo_caja} + ${data.monto_boleta_deposito}` });
    }

    return { ok: true };
  } catch {
    return { error: "Error al liquidar el vale" };
  }
}
