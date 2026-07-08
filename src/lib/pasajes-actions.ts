"use server";
import { db } from "@/lib/db";
import { pasajesTarifario, pasajesSolicitudes, pasajesPagos, usuarios } from "@/lib/schema";
import { eq, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { buscarAfiliadoPorAfiliacion } from "@/lib/afiliados-actions";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
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

// ─── Solicitud de Pago de Pasaje (SPS-75) ────────────────────────────────────
export type Tramo = "Ida" | "Vuelta" | "Ida y Vuelta";

export type NuevaSolicitudData = {
  afiliacion: string;
  tramo: Tramo;
  punto_partida: string;
  destino: string;
  lugar_especifico: string;
  especialidad: string;
  caso_concluido: boolean;
  fecha_cita: string;
  observaciones: string;
};

function calcularValorTramo(valorIda: number, tramo: Tramo): number {
  return tramo === "Ida y Vuelta" ? valorIda * 2 : valorIda;
}

export async function crearSolicitudPasaje(data: NuevaSolicitudData): Promise<{ ok: true; numero: number } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    if (!data.afiliacion.trim()) return { error: "El número de afiliación es obligatorio" };
    if (!["Ida", "Vuelta", "Ida y Vuelta"].includes(data.tramo)) return { error: "Selecciona Ida, Vuelta o Ida y Vuelta" };
    if (!data.punto_partida.trim() || !data.destino.trim()) return { error: "Punto de partida y destino son obligatorios" };
    if (!data.caso_concluido && !data.fecha_cita) return { error: "Indica la fecha de la cita, o marca que el caso fue concluido" };

    const afiliado = await buscarAfiliadoPorAfiliacion(data.afiliacion);
    if (!afiliado) return { error: "No se encontró un afiliado con ese número de afiliación" };

    const tarifa = await buscarTarifa(data.punto_partida, data.destino);
    if (!tarifa) return { error: `No existe tarifa registrada para la ruta "${data.punto_partida}" → "${data.destino}". Regístrala primero en Pago de Pasajes/Tarifario.` };

    const res = await db.execute(sql`SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM pasajes_solicitudes`);
    const numero = Number((res.rows[0] as any).next) || 1;

    await db.insert(pasajesSolicitudes).values({
      numero,
      fecha: new Date().toISOString().slice(0, 10),
      afiliacion: afiliado.afiliacion,
      nombre_afiliado: afiliado.nombre,
      direccion: afiliado.direccion,
      tramo: data.tramo,
      punto_partida: data.punto_partida.trim(),
      destino: data.destino.trim(),
      lugar_especifico: data.lugar_especifico.trim() || null,
      especialidad: data.especialidad.trim() || null,
      caso_concluido: data.caso_concluido,
      fecha_cita: data.caso_concluido ? null : (data.fecha_cita || null),
      observaciones: data.observaciones.trim() || null,
      creado_por: check.uid,
    });

    return { ok: true, numero };
  } catch {
    return { error: "Error al registrar la solicitud de pasaje" };
  }
}

export async function editarYReenviarSolicitud(id: number, data: NuevaSolicitudData): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    const [solicitud] = await db.select().from(pasajesSolicitudes).where(eq(pasajesSolicitudes.id, id)).limit(1);
    if (!solicitud) return { error: "No se encontró la solicitud" };
    if (solicitud.estado !== "Rechazada") return { error: "Solo se pueden editar solicitudes rechazadas" };

    if (!["Ida", "Vuelta", "Ida y Vuelta"].includes(data.tramo)) return { error: "Selecciona Ida, Vuelta o Ida y Vuelta" };
    if (!data.punto_partida.trim() || !data.destino.trim()) return { error: "Punto de partida y destino son obligatorios" };
    if (!data.caso_concluido && !data.fecha_cita) return { error: "Indica la fecha de la cita, o marca que el caso fue concluido" };

    const tarifa = await buscarTarifa(data.punto_partida, data.destino);
    if (!tarifa) return { error: `No existe tarifa registrada para la ruta "${data.punto_partida}" → "${data.destino}"` };

    await db.update(pasajesSolicitudes).set({
      tramo: data.tramo,
      punto_partida: data.punto_partida.trim(),
      destino: data.destino.trim(),
      lugar_especifico: data.lugar_especifico.trim() || null,
      especialidad: data.especialidad.trim() || null,
      caso_concluido: data.caso_concluido,
      fecha_cita: data.caso_concluido ? null : (data.fecha_cita || null),
      observaciones: data.observaciones.trim() || null,
      estado: "Pendiente DPD-23",
      motivo_rechazo: null,
    }).where(eq(pasajesSolicitudes.id, id));

    return { ok: true };
  } catch {
    return { error: "Error al reenviar la solicitud" };
  }
}

export async function listarSolicitudesPasaje() {
  return db.select().from(pasajesSolicitudes).orderBy(desc(pasajesSolicitudes.numero));
}

export async function listarSolicitudesPendientes() {
  return db.select().from(pasajesSolicitudes)
    .where(eq(pasajesSolicitudes.estado, "Pendiente DPD-23"))
    .orderBy(desc(pasajesSolicitudes.numero));
}

export async function getSolicitudPasaje(numero: number) {
  const [row] = await db.select().from(pasajesSolicitudes).where(eq(pasajesSolicitudes.numero, numero)).limit(1);
  return row ?? null;
}

// ─── DPD-23 — Aceptar/Rechazar una Solicitud de Pago de Pasaje ───────────────
export async function siguienteFormularioNo(): Promise<number> {
  const res = await db.execute(sql`SELECT COALESCE(MAX(formulario_no), 0) + 1 AS next FROM pasajes_pagos`);
  return Number((res.rows[0] as any).next) || 1;
}

export async function listarPagosPasajes() {
  const rows = await db.select({
    pago: pasajesPagos,
    creado_por_nombre: usuarios.nombre,
  }).from(pasajesPagos)
    .leftJoin(usuarios, eq(pasajesPagos.creado_por, usuarios.id))
    .orderBy(desc(pasajesPagos.formulario_no));
  return rows.map(r => ({ ...r.pago, creado_por_nombre: r.creado_por_nombre }));
}

export async function getPagoPasaje(formularioNo: number) {
  const [row] = await db.select().from(pasajesPagos).where(eq(pasajesPagos.formulario_no, formularioNo)).limit(1);
  return row ?? null;
}

export async function aceptarSolicitudPasaje(solicitudId: number): Promise<{ ok: true; formulario_no: number } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    const [solicitud] = await db.select().from(pasajesSolicitudes).where(eq(pasajesSolicitudes.id, solicitudId)).limit(1);
    if (!solicitud) return { error: "No se encontró la solicitud" };
    if (solicitud.estado !== "Pendiente DPD-23") return { error: "Esta solicitud ya fue procesada" };

    const afiliado = await buscarAfiliadoPorAfiliacion(solicitud.afiliacion);
    if (!afiliado) return { error: "No se encontró el afiliado de la solicitud" };

    const tarifa = await buscarTarifa(solicitud.punto_partida, solicitud.destino);
    if (!tarifa) return { error: `No existe tarifa registrada para la ruta "${solicitud.punto_partida}" → "${solicitud.destino}"` };

    const formularioNo = await siguienteFormularioNo();
    const tramo = solicitud.tramo as Tramo;

    await db.insert(pasajesPagos).values({
      formulario_no: formularioNo,
      solicitud_id: solicitud.id,
      fecha_pago: new Date().toISOString().slice(0, 10),
      afiliacion: afiliado.afiliacion,
      nombre_afiliado: afiliado.nombre,
      calidad: afiliado.calidad,
      dpi: afiliado.dpi,
      numero_patronal: afiliado.numero_patronal,
      patrono: afiliado.patrono,
      punto_partida: solicitud.punto_partida,
      destino: solicitud.destino,
      ida: tramo === "Ida" || tramo === "Ida y Vuelta",
      vuelta: tramo === "Vuelta" || tramo === "Ida y Vuelta",
      valor_pasaje: calcularValorTramo(tarifa.valor_ida, tramo),
      observaciones: solicitud.observaciones,
      fecha_cita: solicitud.fecha_cita,
      creado_por: check.uid,
    });

    await db.update(pasajesSolicitudes).set({ estado: "Generado" }).where(eq(pasajesSolicitudes.id, solicitud.id));

    return { ok: true, formulario_no: formularioNo };
  } catch {
    return { error: "Error al generar el DPD-23" };
  }
}

export async function rechazarSolicitudPasaje(solicitudId: number, motivo: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (!motivo.trim()) return { error: "El motivo del rechazo es obligatorio" };

    const [solicitud] = await db.select().from(pasajesSolicitudes).where(eq(pasajesSolicitudes.id, solicitudId)).limit(1);
    if (!solicitud) return { error: "No se encontró la solicitud" };
    if (solicitud.estado !== "Pendiente DPD-23") return { error: "Esta solicitud ya fue procesada" };

    await db.update(pasajesSolicitudes).set({ estado: "Rechazada", motivo_rechazo: motivo.trim() }).where(eq(pasajesSolicitudes.id, solicitudId));

    return { ok: true };
  } catch {
    return { error: "Error al rechazar la solicitud" };
  }
}
