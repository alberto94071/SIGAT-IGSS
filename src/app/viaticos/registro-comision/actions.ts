"use server";
import { db } from "@/lib/db";
import { viaticoSolicitudes, viaticoComisiones, viaticoGastos, viaticoPagos, usuarios, configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { requireTabAccessAction } from "@/lib/modulo-access";
import { sumarDiasHabiles } from "@/lib/dias-habiles";
import { fechaHoraGuatemala } from "@/lib/date-utils";
import { preciosPorGrupo } from "@/lib/viatico-precios";

const TAB = "tab_viaticos_comision" as const;

function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type ComisionParaNarrativo = {
  lugar: string | null; departamento: string | null; tipo_comision: string | null; descripcion_comision: string | null;
  fecha_llegada_lugar: string | null; hora_llegada_lugar: string | null; hora_salida_lugar: string | null;
  nombramiento_numero: string | null;
};

// Plantilla exacta extraída de un Informe de Comisión real que mandó el
// cliente (MODELO_VIATICO.pdf, 2026-09-07): una oración por comisión,
// concatenando descripcion_comision con nombramiento/fecha/horas de llegada
// y salida del lugar, más el mismo cierre fijo en todos los casos. Se
// genera una sola vez al aprobar (no en cada carga de la página) — el
// colaborador la puede editar después desde el textarea, este es solo el
// punto de partida en vez de dejarlo en blanco.
function generarInformeComision(comisiones: ComisionParaNarrativo[], numeroFormulario: string | null): string {
  return comisiones.map(c => {
    const lugar = [c.lugar, c.departamento].filter(Boolean).join(", ");
    return `La Comisión realizada en fecha ${fechaCorta(c.fecha_llegada_lugar)} descrito en el Formulario V-L No. `
      + `${numeroFormulario ?? ""}, de conformidad con el Nombramiento de Comisión No. ${c.nombramiento_numero ?? ""}, `
      + `en relación a; ${c.tipo_comision ?? ""} en ${lugar}, en horario de ${c.hora_llegada_lugar ?? ""} a `
      + `${c.hora_salida_lugar ?? ""} horas, ${c.descripcion_comision ?? ""}, posteriormente retorné a mi lugar de `
      + `trabajo para informar de lo actuado y reportar que dicha comisión se realizó a entera satisfacción.`;
  }).join("\n\n");
}

// Reemplaza la plantilla anterior (2026-09-07, "La Unidad Integral de
// Adscripción..." sobre Tejutla/295km) por el texto literal de una carta
// real que el cliente mandó (2026-09-19, dirigida al Jefe de DAF,
// Quetzaltenango) con la instrucción explícita "así tiene que quedar
// literalmente la justificación" — la fecha (lugarYFecha, ver
// justificacion/page.tsx) y el número de Nombramiento son los únicos dos
// datos dinámicos que el cliente marcó; el resto del texto es fijo, tal
// cual (incluye una preposición faltante y "comision"/"guatemala" en
// minúscula, ya en el original del cliente — se preserva literal, no se
// corrige). El encabezado en negrita ("JUSTIFICACIÓN DEL PAGO DE CENA Y
// HOSPEDAJE") y el saludo/párrafo de cortesía previos NO viven acá — son
// props fijos de ImprimirNarrativoClient (seccionTitulo/parrafoIntro,
// modo cartaFormal), esto solo genera el cuerpo de dos párrafos que el
// colaborador puede seguir editando después desde el textarea.
function generarJustificacionEstancia(comisiones: ComisionParaNarrativo[]): string {
  const nombramiento = comisiones.find(c => c.nombramiento_numero)?.nombramiento_numero ?? "";
  return `Por la distancia que existe de nuestro lugar de trabajo a la ciudad de Guatemala aproximadamente 310 kilómetros; el tiempo de viaje es de aproximadamente 7 horas; el tráfico al ingreso la ciudad capital, es necesario viajar un día antes, cabe mencionar que por el horario de llegada a guatemala y la inseguridad que se vive actualmente, la obtención de un sello representa un riesgo para mi integridad.

Por lo descrito anteriormente fui comisionado(a) un día antes, según consta en Nombramiento No. ${nombramiento}, para estar presente en el lugar fecha y hora establecida y dar cumplimiento a la comision por la cual fui comisionado(a).`;
}

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
  const gastos = await db.select().from(viaticoGastos)
    .where(eq(viaticoGastos.solicitud_id, id)).orderBy(viaticoGastos.orden);
  return { ...sol, comisiones, gastos };
}

// Archivo: solicitudes ya resueltas (Aprobado, Rechazado, o el formulario se
// marcó Anulado/Extraviado) — pantalla "Entrega de Formulario", para
// reimprimir V-A/V-C/V-L (solo Aprobado tiene algo que reimprimir) o para
// consultar por qué un formulario no llegó a usarse.
export async function getSolicitudesArchivo() {
  const rows = await db.select({
    id: viaticoSolicitudes.id, numero_formulario: viaticoSolicitudes.numero_formulario,
    persona_nombre: viaticoSolicitudes.persona_nombre, estado: viaticoSolicitudes.estado,
    aprobado_en: viaticoSolicitudes.aprobado_en, rechazado_en: viaticoSolicitudes.rechazado_en,
    motivo_rechazo: viaticoSolicitudes.motivo_rechazo,
    formulario_motivo: viaticoSolicitudes.formulario_motivo, formulario_marcado_en: viaticoSolicitudes.formulario_marcado_en,
  }).from(viaticoSolicitudes)
    .where(sql`${viaticoSolicitudes.estado} IN ('Aprobado', 'Rechazado', 'Anulado', 'Extraviado')`)
    .orderBy(sql`${viaticoSolicitudes.id} DESC`);
  return rows;
}

// Formularios ya asignados (Habilitado/Enviado, ya tienen numero_formulario)
// que todavía no llegan a Aprobado — bandeja para marcarlos Anulado/
// Extraviado si el colaborador perdió o malogró la hoja física (pedido del
// cliente 2026-09-09, para poder justificar en el Libro de Viáticos qué
// pasó con cada No. de Formulario del talonario, no solo los que sí se
// pagaron).
export async function getSolicitudesEnTramite() {
  const rows = await db.select({
    id: viaticoSolicitudes.id, numero_formulario: viaticoSolicitudes.numero_formulario,
    persona_nombre: viaticoSolicitudes.persona_nombre, estado: viaticoSolicitudes.estado,
    nombramiento_numero: viaticoSolicitudes.nombramiento_numero, fecha_nombramiento: viaticoSolicitudes.fecha_nombramiento,
  }).from(viaticoSolicitudes)
    .where(sql`${viaticoSolicitudes.estado} IN ('Habilitado', 'Enviado')`)
    .orderBy(sql`${viaticoSolicitudes.id} ASC`);
  return rows;
}

async function marcarFormulario(id: number, estadoNuevo: "Anulado" | "Extraviado", motivo: string): Promise<{ ok: true } | { error: string }> {
  const check = await requireTabAccessAction("mod_viaticos", TAB);
  if ("error" in check) return check;

  const [sol] = await db.select({ estado: viaticoSolicitudes.estado }).from(viaticoSolicitudes)
    .where(eq(viaticoSolicitudes.id, id)).limit(1);
  if (!sol) return { error: "No se encontró la solicitud" };
  if (!["Habilitado", "Enviado"].includes(sol.estado)) return { error: "Este formulario ya no se puede marcar — no está en trámite" };

  await db.update(viaticoSolicitudes).set({
    estado: estadoNuevo,
    formulario_motivo: motivo.trim() || null,
    formulario_marcado_por: check.uid,
    formulario_marcado_en: fechaHoraGuatemala(),
  }).where(eq(viaticoSolicitudes.id, id));

  return { ok: true };
}

export async function marcarFormularioAnulado(id: number, motivo: string) {
  return marcarFormulario(id, "Anulado", motivo);
}

export async function marcarFormularioExtraviado(id: number, motivo: string) {
  return marcarFormulario(id, "Extraviado", motivo);
}

// Por si el encargado se equivocó marcando Anulado/Extraviado — regresa el
// formulario a "Habilitado" para que el colaborador siga su trámite normal.
export async function revertirMarcaFormulario(id: number): Promise<{ ok: true } | { error: string }> {
  const check = await requireTabAccessAction("mod_viaticos", TAB);
  if ("error" in check) return check;

  const [sol] = await db.select({ estado: viaticoSolicitudes.estado }).from(viaticoSolicitudes)
    .where(eq(viaticoSolicitudes.id, id)).limit(1);
  if (!sol) return { error: "No se encontró la solicitud" };
  if (!["Anulado", "Extraviado"].includes(sol.estado)) return { error: "Este formulario no está marcado como Anulado/Extraviado" };

  await db.update(viaticoSolicitudes).set({
    estado: "Habilitado",
    formulario_motivo: null, formulario_marcado_por: null, formulario_marcado_en: null,
  }).where(eq(viaticoSolicitudes.id, id));

  return { ok: true };
}

export type DatosAprobar = {
  // Gastos itemizados (Planilla de Viáticos) que respaldan "Otros Gastos
  // Derivados" — uno por solicitud (ej. pasaje de ida y vuelta), no por
  // comisión (decisión del cliente 2026-09-07). otros_gastos en
  // viatico_solicitudes se sigue guardando como la suma de estos.
  gastos: { fecha: string; descripcion: string; valor: number }[];
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

  const [sol] = await db.select({
    estado: viaticoSolicitudes.estado, numero_formulario: viaticoSolicitudes.numero_formulario,
    persona_nombre: viaticoSolicitudes.persona_nombre, persona_grupo: viaticoSolicitudes.persona_grupo,
  }).from(viaticoSolicitudes).where(eq(viaticoSolicitudes.id, id)).limit(1);
  if (!sol) return { error: "No se encontró la solicitud" };
  if (sol.estado !== "Enviado") return { error: "Esta solicitud no está pendiente de revisión" };

  const gastosValidos = datos.gastos.filter(g => g.descripcion.trim() || g.valor > 0);
  const otrosGastos = gastosValidos.reduce((sum, g) => sum + (Number(g.valor) || 0), 0);

  // Total del V-L (campo 15), mismo cálculo que ImprimirVLClient.tsx — se
  // recalcula acá (server-side) para guardar el snapshot que alimenta Fondo
  // Rotativo/Pagos (ver viatico-pagos-actions.ts, Fase F 2026-09-08). El
  // precio de cada servicio depende del grupo del empleado (2026-09-20, ver
  // viatico-precios.ts) — no es fijo para todos.
  const [cfg] = await db.select({
    viatico_cuota_grupo_1_2: configuracion.viatico_cuota_grupo_1_2, viatico_cuota_grupo_3: configuracion.viatico_cuota_grupo_3,
    viatico_cuota_grupo_4: configuracion.viatico_cuota_grupo_4, viatico_cuota_grupo_5: configuracion.viatico_cuota_grupo_5,
  }).from(configuracion).limit(1);
  const precios = preciosPorGrupo(sol.persona_grupo, cfg ?? { viatico_cuota_grupo_1_2: 600, viatico_cuota_grupo_3: 500, viatico_cuota_grupo_4: 400, viatico_cuota_grupo_5: 300 });
  const serviciosComisiones = await db.select({
    cantidad_desayuno: viaticoComisiones.cantidad_desayuno, cantidad_almuerzo: viaticoComisiones.cantidad_almuerzo,
    cantidad_cena: viaticoComisiones.cantidad_cena, cantidad_hospedaje: viaticoComisiones.cantidad_hospedaje,
  }).from(viaticoComisiones).where(eq(viaticoComisiones.solicitud_id, id));
  const sumaGastos = serviciosComisiones.reduce((sum, c) =>
    sum + c.cantidad_desayuno * precios.desayuno + c.cantidad_almuerzo * precios.almuerzo
        + c.cantidad_cena * precios.cena + c.cantidad_hospedaje * precios.hospedaje, 0);
  const total11 = sumaGastos + otrosGastos;
  const totalVl = total11 - (datos.reintegro ?? 0) + (datos.complemento ?? 0);

  // El Informe de Comisión y la Justificación de Estancia se pre-llenan al
  // aprobar (2026-09-07, ver generarInformeComision/generarJustificacionEstancia
  // arriba) — antes quedaban en blanco y el colaborador los escribía desde
  // cero. Se generan una sola vez acá; el colaborador los sigue pudiendo
  // editar después desde el textarea, esto es solo el punto de partida.
  const comisiones = await db.select({
    lugar: viaticoComisiones.lugar, departamento: viaticoComisiones.departamento,
    tipo_comision: viaticoComisiones.tipo_comision, descripcion_comision: viaticoComisiones.descripcion_comision,
    fecha_llegada_lugar: viaticoComisiones.fecha_llegada_lugar, hora_llegada_lugar: viaticoComisiones.hora_llegada_lugar,
    hora_salida_lugar: viaticoComisiones.hora_salida_lugar, nombramiento_numero: viaticoComisiones.nombramiento_numero,
  }).from(viaticoComisiones).where(eq(viaticoComisiones.solicitud_id, id)).orderBy(viaticoComisiones.orden);

  await db.update(viaticoSolicitudes).set({
    estado: "Aprobado",
    aprobado_por: check.uid,
    aprobado_en: fechaHoraGuatemala(),
    otros_gastos: otrosGastos,
    recibido_va_no: datos.recibido_va_no.trim() || null,
    recibido_va_monto: datos.recibido_va_monto,
    reintegro: datos.reintegro,
    complemento: datos.complemento,
    informe_comision: generarInformeComision(comisiones, sol.numero_formulario),
    justificacion_estancia: generarJustificacionEstancia(comisiones),
  }).where(eq(viaticoSolicitudes.id, id));

  await db.delete(viaticoGastos).where(eq(viaticoGastos.solicitud_id, id));
  if (gastosValidos.length > 0) {
    await db.insert(viaticoGastos).values(gastosValidos.map((g, i) => ({
      solicitud_id: id, fecha: g.fecha || null, descripcion: g.descripcion.trim() || null,
      valor: Number(g.valor) || 0, orden: i + 1,
    })));
  }

  // Fase F (2026-09-08): un V-L Aprobado se vuelve un pago más de Fondo
  // Rotativo — se crea acá mismo, una sola vez (esta solicitud nunca vuelve
  // a pasar por "Enviado" → "Aprobado" dos veces). Ver viatico-pagos-actions.ts.
  await db.insert(viaticoPagos).values({
    viatico_solicitud_id: id, total: totalVl, destinatario_nombre: sol.persona_nombre, creado_por: check.uid,
  });

  return { ok: true };
}

/**
 * Devuelve un V-L ya Aprobado a "Enviado" — por si se aprobó una solicitud
 * equivocada o con datos mal capturados en el modal de revisión. Borra el
 * viatico_pagos que se creó al aprobar (Fase F) y limpia los campos de
 * Liquidación/Informe/Justificación que se llenaron en ese mismo paso, para
 * que el encargado vuelva a revisar desde cero. Solo mientras el pago siga
 * "Pendiente forma de pago" sin forma_pago elegida — si ya se eligió
 * cheque/efectivo, ya se movió hacia Fondo Rotativo/Pagos y hay que
 * devolverlo desde ahí primero (devolverAFormaPagoViatico, una vez llegue a
 * "Pendiente FRI") antes de poder llegar hasta acá.
 */
export async function devolverSolicitudAprobada(id: number): Promise<{ ok: true } | { error: string }> {
  const check = await requireTabAccessAction("mod_viaticos", TAB);
  if ("error" in check) return check;

  const [sol] = await db.select({ estado: viaticoSolicitudes.estado }).from(viaticoSolicitudes)
    .where(eq(viaticoSolicitudes.id, id)).limit(1);
  if (!sol) return { error: "No se encontró la solicitud" };
  if (sol.estado !== "Aprobado") return { error: "Esta solicitud no está aprobada" };

  const [pago] = await db.select({ id: viaticoPagos.id, forma_pago: viaticoPagos.forma_pago })
    .from(viaticoPagos).where(eq(viaticoPagos.viatico_solicitud_id, id)).limit(1);
  if (pago?.forma_pago != null) {
    return { error: "Ya se eligió la forma de pago de este viático en Fondo Rotativo/Pagos — devuélvelo primero desde ahí" };
  }

  await db.transaction(async (tx) => {
    if (pago) await tx.delete(viaticoPagos).where(eq(viaticoPagos.id, pago.id));
    await tx.update(viaticoSolicitudes).set({
      estado: "Enviado",
      aprobado_por: null, aprobado_en: null,
      otros_gastos: 0,
      recibido_va_no: null, recibido_va_monto: null,
      reintegro: null, complemento: null,
      informe_comision: null, justificacion_estancia: null,
    }).where(eq(viaticoSolicitudes.id, id));
  });

  return { ok: true };
}

// Por si el encargado rechazó por error, o el colaborador necesita corregir
// datos de la comisión (ej. cantidades de servicio mal capturadas) antes de
// volver a enviar — regresa a "Habilitado" (no solo a "Enviado", que queda
// de solo lectura para el colaborador) para que pueda usar
// agregarComision/eliminarComision de nuevo (solicitar-viaticos/actions.ts,
// gate por estado === "Habilitado") y corregir la comisión borrándola y
// volviéndola a registrar con los datos correctos. Mismo patrón que
// revertirMarcaFormulario, pedido explícito del cliente 2026-09-17 con un
// caso real (Formulario 117971, Rechazado, sin ninguna acción disponible).
export async function revertirRechazo(id: number): Promise<{ ok: true } | { error: string }> {
  const check = await requireTabAccessAction("mod_viaticos", TAB);
  if ("error" in check) return check;

  const [sol] = await db.select({ estado: viaticoSolicitudes.estado }).from(viaticoSolicitudes)
    .where(eq(viaticoSolicitudes.id, id)).limit(1);
  if (!sol) return { error: "No se encontró la solicitud" };
  if (sol.estado !== "Rechazado") return { error: "Esta solicitud no está rechazada" };

  await db.update(viaticoSolicitudes).set({
    estado: "Habilitado",
    rechazado_por: null, rechazado_en: null, motivo_rechazo: null,
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
// comisión (nombre + cargo) contra catalogoFirmantes (2026-09-08, mismo
// catálogo que ya firma los A-01 SIAF), para no tener que hacerlo de nuevo
// en cada componente de impresión.
export async function getSolicitudParaImprimir(id: number) {
  const session = await auth();
  if (!session) return null;

  const [sol] = await db.select().from(viaticoSolicitudes).where(eq(viaticoSolicitudes.id, id)).limit(1);
  if (!sol) return null;

  const comisionesRaw = await db.select().from(viaticoComisiones)
    .where(eq(viaticoComisiones.solicitud_id, id)).orderBy(viaticoComisiones.orden);

  const firmanteIds = [...new Set(comisionesRaw.map(c => c.firmante_catalogo_id).filter((x): x is number => x != null))];
  const firmantesMap = new Map<number, { nombre: string; cargo: string }>();
  if (firmanteIds.length > 0) {
    const filas = await db.select({ id: catalogoFirmantes.id, nombre: catalogoFirmantes.nombre, cargo: catalogoFirmantes.cargo })
      .from(catalogoFirmantes).where(sql`${catalogoFirmantes.id} IN (${sql.join(firmanteIds, sql`, `)})`);
    for (const f of filas) firmantesMap.set(f.id, f);
  }

  const comisiones = comisionesRaw.map(c => {
    const firmante = c.firmante_catalogo_id != null ? firmantesMap.get(c.firmante_catalogo_id) : null;
    return {
      ...c,
      firmante_nombre: firmante?.nombre ?? null,
      firmante_cargo: firmante?.cargo ?? null,
    };
  });

  const gastos = await db.select().from(viaticoGastos)
    .where(eq(viaticoGastos.solicitud_id, id)).orderBy(viaticoGastos.orden);

  return { ...sol, comisiones, gastos };
}
