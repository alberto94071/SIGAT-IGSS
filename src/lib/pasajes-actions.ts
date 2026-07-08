"use server";
import { db } from "@/lib/db";
import { pasajesAfiliados, pasajesTarifario, pasajesPagos, valesCajaChica, usuarios } from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

// ─── Afiliados (autocompletado) ──────────────────────────────────────────────
export async function buscarAfiliado(afiliacion: string) {
  const a = afiliacion.trim();
  if (!a) return null;
  const [row] = await db.select().from(pasajesAfiliados).where(eq(pasajesAfiliados.afiliacion, a)).limit(1);
  return row ?? null;
}

// ─── Tarifario ────────────────────────────────────────────────────────────────
export async function listarTarifario() {
  return db.select().from(pasajesTarifario).orderBy(pasajesTarifario.punto_partida, pasajesTarifario.destino);
}

export async function buscarTarifa(puntoPartida: string, destino: string) {
  const [row] = await db.select().from(pasajesTarifario)
    .where(sql`${pasajesTarifario.punto_partida} = ${puntoPartida} AND ${pasajesTarifario.destino} = ${destino}`)
    .limit(1);
  return row ?? null;
}

export type NuevaTarifaData = { punto_partida: string; destino: string; valor_ida: number };

export async function crearTarifa(data: NuevaTarifaData): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (!data.punto_partida.trim() || !data.destino.trim()) return { error: "Punto de partida y destino son obligatorios" };
    if (!(data.valor_ida > 0)) return { error: "Ingresa un valor de ida válido" };

    await db.insert(pasajesTarifario).values({
      punto_partida: data.punto_partida.trim(), destino: data.destino.trim(),
      valor_ida: data.valor_ida, creado_por: check.uid,
    });
    return { ok: true };
  } catch {
    return { error: "Error al crear la tarifa" };
  }
}

export async function actualizarTarifa(id: number, data: NuevaTarifaData): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (!data.punto_partida.trim() || !data.destino.trim()) return { error: "Punto de partida y destino son obligatorios" };
    if (!(data.valor_ida > 0)) return { error: "Ingresa un valor de ida válido" };

    await db.update(pasajesTarifario).set({
      punto_partida: data.punto_partida.trim(), destino: data.destino.trim(), valor_ida: data.valor_ida,
    }).where(eq(pasajesTarifario.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al actualizar la tarifa" };
  }
}

export async function eliminarTarifa(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    await db.delete(pasajesTarifario).where(eq(pasajesTarifario.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al eliminar la tarifa" };
  }
}

// ─── Vales de Caja Chica pendientes (para ligar el pago de pasaje) ───────────
export async function getValesParaPasaje() {
  return db.select({
    id: valesCajaChica.id, numero: valesCajaChica.numero, monto: valesCajaChica.monto,
    solicitante_nombre: valesCajaChica.solicitante_nombre, numero_cheque: valesCajaChica.numero_cheque,
  }).from(valesCajaChica).where(eq(valesCajaChica.estado, "Pendiente")).orderBy(desc(valesCajaChica.numero));
}

// ─── Historial de pagos de pasajes ────────────────────────────────────────────
export async function siguienteFormularioNo(): Promise<number> {
  const res = await db.execute(sql`SELECT COALESCE(MAX(formulario_no), 0) + 1 AS next FROM pasajes_pagos`);
  return Number((res.rows[0] as any).next) || 1;
}

export async function listarPagosPasajes() {
  const rows = await db.select({
    pago: pasajesPagos,
    vale_numero: valesCajaChica.numero,
    creado_por_nombre: usuarios.nombre,
  }).from(pasajesPagos)
    .leftJoin(valesCajaChica, eq(pasajesPagos.vale_id, valesCajaChica.id))
    .leftJoin(usuarios, eq(pasajesPagos.creado_por, usuarios.id))
    .orderBy(desc(pasajesPagos.formulario_no));
  return rows.map(r => ({ ...r.pago, vale_numero: r.vale_numero, creado_por_nombre: r.creado_por_nombre }));
}

export async function getPagoPasaje(formularioNo: number) {
  const [row] = await db.select().from(pasajesPagos).where(eq(pasajesPagos.formulario_no, formularioNo)).limit(1);
  return row ?? null;
}

export type NuevoPagoPasajeData = {
  afiliacion: string;
  punto_partida: string;
  destino: string;
  ida: boolean;
  vuelta: boolean;
  observaciones: string;
  fecha_cita: string;
  poliza_no: number | null;
  cheque_no: string;
  vale_id: number;
};

export async function registrarPagoPasaje(data: NuevoPagoPasajeData): Promise<{ ok: true; formulario_no: number } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    if (!data.afiliacion.trim()) return { error: "El número de afiliación es obligatorio" };
    if (!data.punto_partida.trim() || !data.destino.trim()) return { error: "Punto de partida y destino son obligatorios" };
    if (!data.ida && !data.vuelta) return { error: "Selecciona al menos Ida o Vuelta" };
    if (!data.cheque_no.trim()) return { error: "El número de cheque es obligatorio" };
    if (!data.vale_id) return { error: "El número de vale es obligatorio" };

    const afiliado = await buscarAfiliado(data.afiliacion);
    if (!afiliado) return { error: "No se encontró un afiliado con ese número de afiliación" };

    const tarifa = await buscarTarifa(data.punto_partida, data.destino);
    if (!tarifa) return { error: `No existe tarifa registrada para la ruta "${data.punto_partida}" → "${data.destino}". Regístrala primero en Caja Chica/Tarifario.` };

    const [vale] = await db.select().from(valesCajaChica).where(eq(valesCajaChica.id, data.vale_id)).limit(1);
    if (!vale) return { error: "No se encontró el vale seleccionado" };
    if (vale.estado !== "Pendiente") return { error: "El vale seleccionado ya fue utilizado" };

    const valorPasaje = (data.ida ? tarifa.valor_ida : 0) + (data.vuelta ? tarifa.valor_ida : 0);
    const formularioNo = await siguienteFormularioNo();

    await db.insert(pasajesPagos).values({
      formulario_no: formularioNo,
      fecha_pago: new Date().toISOString().slice(0, 10),
      afiliacion: afiliado.afiliacion,
      nombre_afiliado: afiliado.nombre,
      calidad: afiliado.calidad,
      dpi: afiliado.dpi,
      numero_patronal: afiliado.numero_patronal,
      patrono: afiliado.patrono,
      punto_partida: data.punto_partida.trim(),
      destino: data.destino.trim(),
      ida: data.ida,
      vuelta: data.vuelta,
      valor_pasaje: valorPasaje,
      observaciones: data.observaciones.trim() || null,
      fecha_cita: data.fecha_cita || null,
      poliza_no: data.poliza_no,
      cheque_no: data.cheque_no.trim(),
      vale_id: data.vale_id,
      creado_por: check.uid,
    });

    await db.update(valesCajaChica).set({ estado: "Usado" }).where(eq(valesCajaChica.id, data.vale_id));

    return { ok: true, formulario_no: formularioNo };
  } catch {
    return { error: "Error al registrar el pago de pasaje" };
  }
}

// ─── Póliza / Cuadro de Caja — agrupado por poliza_no ────────────────────────
export async function listarNumerosPoliza() {
  const rows = await db.selectDistinct({ poliza_no: pasajesPagos.poliza_no }).from(pasajesPagos)
    .where(sql`${pasajesPagos.poliza_no} IS NOT NULL`)
    .orderBy(desc(pasajesPagos.poliza_no));
  return rows.map(r => r.poliza_no as number);
}

export async function getPagosPorPoliza(polizaNo: number) {
  return db.select().from(pasajesPagos).where(eq(pasajesPagos.poliza_no, polizaNo)).orderBy(pasajesPagos.formulario_no);
}
