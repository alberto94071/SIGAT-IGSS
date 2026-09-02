"use server";
import { db } from "@/lib/db";
import { viaticoSolicitudes, viaticoComisiones, usuarios, configuracion } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { and, eq, sql } from "drizzle-orm";
import { fechaGuatemala } from "@/lib/date-utils";

async function getMeColaborador() {
  const session = await auth();
  if (!session || session.user.rol !== "colaborador") return null;
  return { id: Number(session.user.id) };
}

// Estados que cuentan como "todavía en trámite" — mientras haya uno así, el
// colaborador no puede pedir un viático nuevo (un solo trámite activo a la
// vez, igual que el borrador único de Solicitar Insumos).
const ESTADOS_ACTIVOS = ["Pendiente", "Habilitado", "Enviado"];

export async function getMisViaticos() {
  const me = await getMeColaborador();
  if (!me) return [];
  return db.select().from(viaticoSolicitudes)
    .where(eq(viaticoSolicitudes.colaborador_id, me.id))
    .orderBy(sql`id DESC`);
}

// Crea la solicitud vacía (estado "Pendiente") — el encargado de Viáticos la
// habilita (nombramiento inicial + snapshot de datos del colaborador) antes
// de que el colaborador pueda registrar comisiones.
export async function solicitarViatico(): Promise<{ ok: true } | { error: string }> {
  const me = await getMeColaborador();
  if (!me) return { error: "No autorizado" };

  const [activa] = await db.select({ id: viaticoSolicitudes.id }).from(viaticoSolicitudes)
    .where(and(eq(viaticoSolicitudes.colaborador_id, me.id), sql`${viaticoSolicitudes.estado} IN ('Pendiente', 'Habilitado', 'Enviado')`))
    .limit(1);
  if (activa) return { error: "Ya tenés un viático en trámite — esperá a que se resuelva antes de pedir otro." };

  await db.insert(viaticoSolicitudes).values({ colaborador_id: me.id, estado: "Pendiente" });
  return { ok: true };
}

const MAX_COMISIONES = 5;

async function getSolicitudDelColaborador(id: number, colaboradorId: number) {
  const [sol] = await db.select().from(viaticoSolicitudes)
    .where(and(eq(viaticoSolicitudes.id, id), eq(viaticoSolicitudes.colaborador_id, colaboradorId)))
    .limit(1);
  return sol ?? null;
}

export async function getSolicitud(id: number) {
  const me = await getMeColaborador();
  if (!me) return null;
  const sol = await getSolicitudDelColaborador(id, me.id);
  if (!sol) return null;
  const comisiones = await db.select().from(viaticoComisiones)
    .where(eq(viaticoComisiones.solicitud_id, id))
    .orderBy(viaticoComisiones.orden);
  return { ...sol, comisiones };
}

// Selector de "quien firmó el nombramiento" — todos los usuarios activos,
// no solo colaboradores (un Director no necesariamente tiene ese rol).
export async function getUsuariosParaFirmante() {
  const me = await getMeColaborador();
  if (!me) return [];
  return db.select({ id: usuarios.id, nombre: usuarios.nombre, puesto_nominal: usuarios.puesto_nominal })
    .from(usuarios).where(eq(usuarios.activo, true)).orderBy(usuarios.nombre);
}

export async function getPreciosServicios() {
  const [cfg] = await db.select({
    desayuno: configuracion.viatico_precio_desayuno, almuerzo: configuracion.viatico_precio_almuerzo,
    cena: configuracion.viatico_precio_cena, hospedaje: configuracion.viatico_precio_hospedaje,
  }).from(configuracion).limit(1);
  return cfg ?? { desayuno: 45, almuerzo: 60, cena: 45, hospedaje: 150 };
}

export type DatosComision = {
  lugar: string; departamento: string; tipo_comision: string; descripcion_comision: string;
  fecha_salida_unidad: string; hora_salida_unidad: string;
  fecha_llegada_lugar: string; hora_llegada_lugar: string;
  fecha_salida_lugar: string; hora_salida_lugar: string;
  fecha_entrada_unidad: string; hora_entrada_unidad: string;
  nombramiento_numero: string; fecha_nombramiento: string;
  firmante_usuario_id: number | null; firmante_cargo_manual: string;
  cantidad_desayuno: number; cantidad_almuerzo: number; cantidad_cena: number; cantidad_hospedaje: number;
};

// Días de calendario entre salida y entrada de la unidad, inclusive — "días
// de comisión" según el cliente (confirmado contra su ejemplo real: salida
// 30/07, entrada 31/07 = 2 días).
function diasCalendarioInclusive(f1: string, f2: string): number {
  const d1 = new Date(`${f1}T00:00:00Z`).getTime();
  const d2 = new Date(`${f2}T00:00:00Z`).getTime();
  return Math.round((d2 - d1) / 86400000) + 1;
}

function validarDatosComision(d: DatosComision): string | null {
  if (!d.lugar.trim()) return "El lugar es obligatorio";
  if (!d.departamento.trim()) return "El departamento es obligatorio";
  if (!d.descripcion_comision.trim()) return "La descripción de la comisión es obligatoria";
  if (!d.fecha_salida_unidad || !d.hora_salida_unidad) return "Fecha y hora de salida de la unidad son obligatorias";
  if (!d.fecha_llegada_lugar || !d.hora_llegada_lugar) return "Fecha y hora de llegada al lugar son obligatorias";
  if (!d.fecha_salida_lugar || !d.hora_salida_lugar) return "Fecha y hora de salida del lugar son obligatorias";
  if (!d.fecha_entrada_unidad || !d.hora_entrada_unidad) return "Fecha y hora de entrada a la unidad son obligatorias";
  if (d.fecha_entrada_unidad < d.fecha_salida_unidad) return "La entrada a la unidad no puede ser antes de la salida";
  if (!d.nombramiento_numero.trim()) return "El No. de nombramiento de esta comisión es obligatorio";
  if (!d.fecha_nombramiento) return "La fecha de nombramiento de esta comisión es obligatoria";
  if (!d.firmante_usuario_id) return "Elegí quién firmó el nombramiento";
  if ([d.cantidad_desayuno, d.cantidad_almuerzo, d.cantidad_cena, d.cantidad_hospedaje].every(c => !(c > 0))) {
    return "Agregá al menos un servicio (desayuno, almuerzo, cena u hospedaje)";
  }
  return null;
}

export async function agregarComision(solicitudId: number, datos: DatosComision): Promise<{ ok: true } | { error: string }> {
  const me = await getMeColaborador();
  if (!me) return { error: "No autorizado" };

  const sol = await getSolicitudDelColaborador(solicitudId, me.id);
  if (!sol) return { error: "No se encontró la solicitud" };
  if (sol.estado !== "Habilitado") return { error: "Esta solicitud no está habilitada para registrar comisiones" };
  if (sol.fecha_limite && fechaGuatemala() > sol.fecha_limite) {
    return { error: `Ya venció el plazo de 10 días hábiles (límite: ${sol.fecha_limite}) — ya no se puede registrar ni enviar este viático.` };
  }

  const error = validarDatosComision(datos);
  if (error) return { error };

  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(viaticoComisiones)
    .where(eq(viaticoComisiones.solicitud_id, solicitudId));
  if (total >= MAX_COMISIONES) return { error: `Ya alcanzaste el máximo de ${MAX_COMISIONES} comisiones por formulario` };

  const [firmante] = await db.select({ puesto_nominal: usuarios.puesto_nominal }).from(usuarios)
    .where(eq(usuarios.id, datos.firmante_usuario_id!)).limit(1);
  if (!firmante) return { error: "El firmante elegido no existe" };
  if (!firmante.puesto_nominal && !datos.firmante_cargo_manual.trim()) {
    return { error: "Ese usuario no tiene un cargo cargado — escribí su cargo a mano" };
  }

  await db.insert(viaticoComisiones).values({
    solicitud_id: solicitudId, orden: total + 1,
    lugar: datos.lugar.trim(), departamento: datos.departamento.trim(),
    tipo_comision: datos.tipo_comision.trim() || null, descripcion_comision: datos.descripcion_comision.trim(),
    fecha_salida_unidad: datos.fecha_salida_unidad, hora_salida_unidad: datos.hora_salida_unidad,
    fecha_llegada_lugar: datos.fecha_llegada_lugar, hora_llegada_lugar: datos.hora_llegada_lugar,
    fecha_salida_lugar: datos.fecha_salida_lugar, hora_salida_lugar: datos.hora_salida_lugar,
    fecha_entrada_unidad: datos.fecha_entrada_unidad, hora_entrada_unidad: datos.hora_entrada_unidad,
    dias_calculados: diasCalendarioInclusive(datos.fecha_salida_unidad, datos.fecha_entrada_unidad),
    nombramiento_numero: datos.nombramiento_numero.trim(), fecha_nombramiento: datos.fecha_nombramiento,
    firmante_usuario_id: datos.firmante_usuario_id,
    firmante_cargo_manual: firmante.puesto_nominal ? null : datos.firmante_cargo_manual.trim(),
    cantidad_desayuno: datos.cantidad_desayuno, cantidad_almuerzo: datos.cantidad_almuerzo,
    cantidad_cena: datos.cantidad_cena, cantidad_hospedaje: datos.cantidad_hospedaje,
  });

  return { ok: true };
}

export async function eliminarComision(comisionId: number): Promise<{ ok: true } | { error: string }> {
  const me = await getMeColaborador();
  if (!me) return { error: "No autorizado" };

  const [row] = await db.select({ com: viaticoComisiones, sol: viaticoSolicitudes }).from(viaticoComisiones)
    .innerJoin(viaticoSolicitudes, eq(viaticoSolicitudes.id, viaticoComisiones.solicitud_id))
    .where(eq(viaticoComisiones.id, comisionId)).limit(1);
  if (!row || row.sol.colaborador_id !== me.id || row.sol.estado !== "Habilitado") return { error: "No encontrada" };

  await db.delete(viaticoComisiones).where(eq(viaticoComisiones.id, comisionId));
  return { ok: true };
}

// Pasa la solicitud a "Enviado" — el encargado de Viáticos la revisa antes
// de que quede oficial (Fase E).
export async function enviarViatico(solicitudId: number): Promise<{ ok: true } | { error: string }> {
  const me = await getMeColaborador();
  if (!me) return { error: "No autorizado" };

  const sol = await getSolicitudDelColaborador(solicitudId, me.id);
  if (!sol) return { error: "No se encontró la solicitud" };
  if (sol.estado !== "Habilitado") return { error: "Esta solicitud no está lista para enviarse" };
  if (sol.fecha_limite && fechaGuatemala() > sol.fecha_limite) {
    return { error: `Ya venció el plazo de 10 días hábiles (límite: ${sol.fecha_limite}) — ya no se puede enviar este viático.` };
  }

  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(viaticoComisiones)
    .where(eq(viaticoComisiones.solicitud_id, solicitudId));
  if (total === 0) return { error: "Registrá al menos una comisión antes de enviar" };

  await db.update(viaticoSolicitudes).set({ estado: "Enviado" }).where(eq(viaticoSolicitudes.id, solicitudId));
  return { ok: true };
}

// Informe de Comisión / Justificación de Estancia — documentos narrativos
// libres aparte de los 3 formularios oficiales, editables por el
// colaborador con un editor simple (textarea) una vez que su viático quedó
// Aprobado (recién ahí tiene sentido reportar lo actuado).
export async function guardarInforme(solicitudId: number, texto: string): Promise<{ ok: true } | { error: string }> {
  const me = await getMeColaborador();
  if (!me) return { error: "No autorizado" };
  const sol = await getSolicitudDelColaborador(solicitudId, me.id);
  if (!sol) return { error: "No se encontró la solicitud" };
  if (sol.estado !== "Aprobado") return { error: "Solo se puede llenar el informe de un viático ya aprobado" };

  await db.update(viaticoSolicitudes).set({ informe_comision: texto }).where(eq(viaticoSolicitudes.id, solicitudId));
  return { ok: true };
}

export async function guardarJustificacion(solicitudId: number, texto: string): Promise<{ ok: true } | { error: string }> {
  const me = await getMeColaborador();
  if (!me) return { error: "No autorizado" };
  const sol = await getSolicitudDelColaborador(solicitudId, me.id);
  if (!sol) return { error: "No se encontró la solicitud" };
  if (sol.estado !== "Aprobado") return { error: "Solo se puede llenar la justificación de un viático ya aprobado" };

  await db.update(viaticoSolicitudes).set({ justificacion_estancia: texto }).where(eq(viaticoSolicitudes.id, solicitudId));
  return { ok: true };
}
