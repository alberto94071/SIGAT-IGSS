"use server";
import { db } from "@/lib/db";
import { viaticoSolicitudes, viaticoComisiones, usuarios } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { requireTabAccessAction } from "@/lib/modulo-access";
import { sumarDiasHabiles } from "@/lib/dias-habiles";
import { fechaHoraGuatemala } from "@/lib/date-utils";

const TAB = "tab_viaticos_comision" as const;

// Bandeja del encargado de Viáticos: solicitudes que un colaborador pidió y
// todavía no se habilitan (sin nombramiento ni datos de persona todavía).
export async function getSolicitudesPendientesHabilitar() {
  const rows = await db.select({
    id: viaticoSolicitudes.id, created_at: viaticoSolicitudes.created_at,
    colaborador_nombre: usuarios.nombre, colaborador_ibm: usuarios.ibm,
    colaborador_puesto: usuarios.puesto_nominal, colaborador_nit: usuarios.nit,
    colaborador_salario: usuarios.salario, colaborador_grupo: usuarios.grupo,
    colaborador_categoria_puesto: usuarios.categoria_puesto,
  }).from(viaticoSolicitudes)
    .innerJoin(usuarios, eq(usuarios.id, viaticoSolicitudes.colaborador_id))
    .where(eq(viaticoSolicitudes.estado, "Pendiente"))
    .orderBy(sql`${viaticoSolicitudes.id} ASC`);
  return rows;
}

// Solicitudes que el colaborador ya registró y envió — bandeja de revisión final.
export async function getSolicitudesEnviadas() {
  const rows = await db.select({
    id: viaticoSolicitudes.id, numero_formulario: viaticoSolicitudes.numero_formulario,
    persona_nombre: viaticoSolicitudes.persona_nombre,
  }).from(viaticoSolicitudes)
    .where(eq(viaticoSolicitudes.estado, "Enviado"))
    .orderBy(sql`${viaticoSolicitudes.id} ASC`);
  return rows;
}

// Detalle completo (solicitud + comisiones) para el modal de revisión final.
export async function getSolicitudCompleta(id: number) {
  const session = await auth();
  if (!session) return null;
  const [sol] = await db.select().from(viaticoSolicitudes).where(eq(viaticoSolicitudes.id, id)).limit(1);
  if (!sol) return null;
  const comisiones = await db.select().from(viaticoComisiones)
    .where(eq(viaticoComisiones.solicitud_id, id)).orderBy(viaticoComisiones.orden);
  return { ...sol, comisiones };
}

// Archivo: solicitudes ya resueltas (Aprobado o Rechazado) — pantalla
// "Entrega de Formulario", para reimprimir V-A/V-C/V-L.
export async function getSolicitudesArchivo() {
  const rows = await db.select({
    id: viaticoSolicitudes.id, numero_formulario: viaticoSolicitudes.numero_formulario,
    persona_nombre: viaticoSolicitudes.persona_nombre, estado: viaticoSolicitudes.estado,
    aprobado_en: viaticoSolicitudes.aprobado_en, rechazado_en: viaticoSolicitudes.rechazado_en,
    motivo_rechazo: viaticoSolicitudes.motivo_rechazo,
  }).from(viaticoSolicitudes)
    .where(sql`${viaticoSolicitudes.estado} IN ('Aprobado', 'Rechazado')`)
    .orderBy(sql`${viaticoSolicitudes.id} DESC`);
  return rows;
}

export type DatosAprobar = {
  otros_gastos: number;
  recibido_va_no: string; recibido_va_monto: number | null;
  reintegro: number | null; complemento: number | null;
};

// Aprobar deja el V-L oficial y listo para imprimir (Fase E) — casi siempre
// los campos de Liquidación quedan vacíos porque el V-A de esta unidad
// siempre se imprime "NO UTILIZADO", pero quedan disponibles por si algún
// día sí se da un anticipo real.
export async function aprobarSolicitud(id: number, datos: DatosAprobar): Promise<{ ok: true } | { error: string }> {
  const check = await requireTabAccessAction("mod_viaticos", TAB);
  if ("error" in check) return check;

  const [sol] = await db.select({ estado: viaticoSolicitudes.estado }).from(viaticoSolicitudes)
    .where(eq(viaticoSolicitudes.id, id)).limit(1);
  if (!sol) return { error: "No se encontró la solicitud" };
  if (sol.estado !== "Enviado") return { error: "Esta solicitud no está pendiente de revisión" };

  await db.update(viaticoSolicitudes).set({
    estado: "Aprobado",
    aprobado_por: check.uid,
    aprobado_en: fechaHoraGuatemala(),
    otros_gastos: datos.otros_gastos,
    recibido_va_no: datos.recibido_va_no.trim() || null,
    recibido_va_monto: datos.recibido_va_monto,
    reintegro: datos.reintegro,
    complemento: datos.complemento,
  }).where(eq(viaticoSolicitudes.id, id));

  return { ok: true };
}

export async function rechazarSolicitud(id: number, motivo: string): Promise<{ ok: true } | { error: string }> {
  const check = await requireTabAccessAction("mod_viaticos", TAB);
  if ("error" in check) return check;
  if (!motivo.trim()) return { error: "Indicá el motivo del rechazo" };

  const [sol] = await db.select({ estado: viaticoSolicitudes.estado }).from(viaticoSolicitudes)
    .where(eq(viaticoSolicitudes.id, id)).limit(1);
  if (!sol) return { error: "No se encontró la solicitud" };
  if (sol.estado !== "Enviado") return { error: "Esta solicitud no está pendiente de revisión" };

  await db.update(viaticoSolicitudes).set({
    estado: "Rechazado",
    rechazado_por: check.uid,
    rechazado_en: fechaHoraGuatemala(),
    motivo_rechazo: motivo.trim(),
  }).where(eq(viaticoSolicitudes.id, id));

  return { ok: true };
}

export type DatosHabilitar = {
  numero_formulario: string;
  nombramiento_numero: string;
  fecha_nombramiento: string;
};

// Llena el nombramiento inicial, calcula el vencimiento de 10 días hábiles y
// copia un snapshot de los datos del colaborador (mismo patrón que
// catalogo_compras → siaf_compras_items) — recién ahí el colaborador puede
// entrar a registrar sus comisiones.
export async function habilitarSolicitud(id: number, datos: DatosHabilitar): Promise<{ ok: true } | { error: string }> {
  const check = await requireTabAccessAction("mod_viaticos", TAB);
  if ("error" in check) return check;

  if (!datos.numero_formulario.trim()) return { error: "El No. de Formulario es obligatorio" };
  if (!datos.nombramiento_numero.trim()) return { error: "El No. de Nombramiento es obligatorio" };
  if (!datos.fecha_nombramiento) return { error: "La fecha de nombramiento es obligatoria" };

  const [sol] = await db.select().from(viaticoSolicitudes).where(eq(viaticoSolicitudes.id, id)).limit(1);
  if (!sol) return { error: "No se encontró la solicitud" };
  if (sol.estado !== "Pendiente") return { error: "Esta solicitud ya fue habilitada" };

  const [colaborador] = await db.select().from(usuarios).where(eq(usuarios.id, sol.colaborador_id)).limit(1);
  if (!colaborador) return { error: "No se encontró el colaborador" };

  const fechaLimite = sumarDiasHabiles(datos.fecha_nombramiento, 10);

  await db.update(viaticoSolicitudes).set({
    estado: "Habilitado",
    numero_formulario: datos.numero_formulario.trim(),
    nombramiento_numero: datos.nombramiento_numero.trim(),
    fecha_nombramiento: datos.fecha_nombramiento,
    fecha_limite: fechaLimite,
    persona_nombre: colaborador.nombre,
    persona_nit: colaborador.nit,
    persona_cargo: colaborador.puesto_nominal,
    persona_no_empleado: colaborador.ibm,
    persona_grupo: colaborador.grupo,
    persona_sueldo: colaborador.salario,
    persona_categoria_puesto: colaborador.categoria_puesto,
    creado_por: check.uid,
  }).where(eq(viaticoSolicitudes.id, id));

  return { ok: true };
}

// Detalle completo para imprimir V-A/V-C/V-L — solo requiere sesión, no un
// permiso puntual: cada ruta de impresión (colaborador vía solicitar-
// viaticos/, encargado vía viaticos/entrega-formulario/) hace su propio
// chequeo de dueño+estado antes de renderizar, mismo patrón que
// getRequisicion en almacen/dab-75/actions.ts. Resuelve el firmante de cada
// comisión (nombre + puesto_nominal) contra usuarios, para no tener que
// hacerlo de nuevo en cada componente de impresión.
export async function getSolicitudParaImprimir(id: number) {
  const session = await auth();
  if (!session) return null;

  const [sol] = await db.select().from(viaticoSolicitudes).where(eq(viaticoSolicitudes.id, id)).limit(1);
  if (!sol) return null;

  const comisionesRaw = await db.select().from(viaticoComisiones)
    .where(eq(viaticoComisiones.solicitud_id, id)).orderBy(viaticoComisiones.orden);

  const firmanteIds = [...new Set(comisionesRaw.map(c => c.firmante_usuario_id).filter((x): x is number => x != null))];
  const firmantesMap = new Map<number, { nombre: string; puesto_nominal: string | null }>();
  if (firmanteIds.length > 0) {
    const filas = await db.select({ id: usuarios.id, nombre: usuarios.nombre, puesto_nominal: usuarios.puesto_nominal })
      .from(usuarios).where(sql`${usuarios.id} IN (${sql.join(firmanteIds, sql`, `)})`);
    for (const f of filas) firmantesMap.set(f.id, f);
  }

  const comisiones = comisionesRaw.map(c => {
    const firmante = c.firmante_usuario_id != null ? firmantesMap.get(c.firmante_usuario_id) : null;
    return {
      ...c,
      firmante_nombre: firmante?.nombre ?? null,
      firmante_cargo: firmante?.puesto_nominal ?? c.firmante_cargo_manual,
    };
  });

  return { ...sol, comisiones };
}
