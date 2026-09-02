"use server";
import { db } from "@/lib/db";
import { viaticoSolicitudes, usuarios } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { requireTabAccessAction } from "@/lib/modulo-access";
import { sumarDiasHabiles } from "@/lib/dias-habiles";

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

// Solicitudes que el colaborador ya registró y envió — bandeja de revisión
// final (Fase E le agrega Aprobar/Rechazar con el detalle de comisiones;
// por ahora, mientras no exista Registro de Comisión, esta lista siempre
// está vacía).
export async function getSolicitudesEnviadas() {
  const rows = await db.select({
    id: viaticoSolicitudes.id, numero_formulario: viaticoSolicitudes.numero_formulario,
    persona_nombre: viaticoSolicitudes.persona_nombre,
  }).from(viaticoSolicitudes)
    .where(eq(viaticoSolicitudes.estado, "Enviado"))
    .orderBy(sql`${viaticoSolicitudes.id} ASC`);
  return rows;
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
