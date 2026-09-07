"use server";
import { db } from "@/lib/db";
import { viaticoSolicitudes, viaticoComisiones, viaticoGastos, viaticoPagos, usuarios, configuracion } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { requireTabAccessAction } from "@/lib/modulo-access";
import { sumarDiasHabiles } from "@/lib/dias-habiles";
import { fechaHoraGuatemala } from "@/lib/date-utils";

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

// El cliente confirmó (2026-09-07) que el primer párrafo de la
// Justificación de Estancia usa la misma concatenación que el Informe
// (con redacción propia, "Fui comisionado para..."), y que el resto del
// documento (párrafos siguientes) es texto fijo que ya debe aparecer por
// defecto — no cambia de un viático a otro. Texto extraído literal del
// modelo real; el colaborador lo puede ajustar después si un caso puntual
// lo necesita (ej. un nombramiento del día anterior distinto a "76/2026").
const JUSTIFICACION_ESTANCIA_FIJA = `La Unidad Integral de Adscripción, Acreditación de Derechos y Despacho de Medicamentos en el Municipio de Tejutla, está ubicada geográficamente a 45 kilómetros de la Cabecera Departamental de San Marcos y a 295 kilómetros de la Ciudad de Guatemala, con una duración de 8 a 10 horas de camino; no existe transporte público ni se tiene vehículo institucional para viajar el mismo día de la comisión a la ciudad de Guatemala.

Por lo descrito anteriormente fui comisionado(a) un día antes, según consta en Nombramiento No. 76/2026, para transportarme del Municipio de Tejutla a la Ciudad de Guatemala, y estar presente en horario y día indicado de la comisión; cabe mencionar que, por la inseguridad que se vive actualmente y no contar con vehículo institucional, no es posible obtener comprobante, firma o sello institucional que avale la estancia un día antes de la comisión.

Por lo que solicito sus buenos oficios a efecto de aceptar la justificación por la estancia de un día antes a la comisión, según documentos anexos que amparan el cobro del viático en cuestión. Atentamente,`;

function generarJustificacionEstancia(comisiones: ComisionParaNarrativo[], numeroFormulario: string | null): string {
  const primerosParrafos = comisiones.map(c => {
    return `Fui comisionado(a) para; ${c.descripcion_comision ?? ""}, según Nombramiento No. ${c.nombramiento_numero ?? ""} `
      + `(Formulario V-L No. ${numeroFormulario ?? ""}), que se llevó a cabo el ${fechaCorta(c.fecha_llegada_lugar)} en `
      + `horario de ${c.hora_llegada_lugar ?? ""} a ${c.hora_salida_lugar ?? ""} horas.`;
  }).join("\n\n");
  return `${primerosParrafos}\n\n${JUSTIFICACION_ESTANCIA_FIJA}`;
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
    persona_nombre: viaticoSolicitudes.persona_nombre,
  }).from(viaticoSolicitudes).where(eq(viaticoSolicitudes.id, id)).limit(1);
  if (!sol) return { error: "No se encontró la solicitud" };
  if (sol.estado !== "Enviado") return { error: "Esta solicitud no está pendiente de revisión" };

  const gastosValidos = datos.gastos.filter(g => g.descripcion.trim() || g.valor > 0);
  const otrosGastos = gastosValidos.reduce((sum, g) => sum + (Number(g.valor) || 0), 0);

  // Total del V-L (campo 15), mismo cálculo que ImprimirVLClient.tsx — se
  // recalcula acá (server-side) para guardar el snapshot que alimenta Fondo
  // Rotativo/Pagos (ver viatico-pagos-actions.ts, Fase F 2026-09-08).
  const [config] = await db.select({
    desayuno: configuracion.viatico_precio_desayuno, almuerzo: configuracion.viatico_precio_almuerzo,
    cena: configuracion.viatico_precio_cena, hospedaje: configuracion.viatico_precio_hospedaje,
  }).from(configuracion).limit(1);
  const serviciosComisiones = await db.select({
    cantidad_desayuno: viaticoComisiones.cantidad_desayuno, cantidad_almuerzo: viaticoComisiones.cantidad_almuerzo,
    cantidad_cena: viaticoComisiones.cantidad_cena, cantidad_hospedaje: viaticoComisiones.cantidad_hospedaje,
  }).from(viaticoComisiones).where(eq(viaticoComisiones.solicitud_id, id));
  const sumaGastos = serviciosComisiones.reduce((sum, c) =>
    sum + c.cantidad_desayuno * (config?.desayuno ?? 45) + c.cantidad_almuerzo * (config?.almuerzo ?? 60)
        + c.cantidad_cena * (config?.cena ?? 45) + c.cantidad_hospedaje * (config?.hospedaje ?? 150), 0);
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
    justificacion_estancia: generarJustificacionEstancia(comisiones, sol.numero_formulario),
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

  const gastos = await db.select().from(viaticoGastos)
    .where(eq(viaticoGastos.solicitud_id, id)).orderBy(viaticoGastos.orden);

  return { ...sol, comisiones, gastos };
}
