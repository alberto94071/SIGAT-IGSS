"use server";
import { fechaGuatemala } from "@/lib/date-utils";
import { db } from "@/lib/db";
import { programacionEntradas, presupuestoRenglones, reprogramaciones, modificacionesPresupuestarias, reprogramacionLotes } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { requireModuloAccessAction } from "@/lib/modulo-access";
import { PRESUPUESTO_DATA } from "@/lib/presupuesto-general-data";
import { GRUPOS, grupoDeRenglon, TIPOS_MODIFICACION, type TipoModificacion } from "@/lib/programacion-constants";
import { getSaldoRenglon, EJERCICIO_FISCAL } from "@/lib/presupuesto-disponible";
import {
  ventanaProgramacionAbierta, mesCreacionProgramacionLabel, fechaAprobacionAutomatica,
  ventanaAprobacionReprogramacionAbierta, ventanaAprobacionModificacionAbierta,
  mesDelCuatrimestreYaPaso,
} from "@/lib/programacion-fechas";
import { procesarCierreCuatrimestres } from "@/lib/cierre-cuatrimestre";

const EJERCICIO = EJERCICIO_FISCAL;

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

// Aprobar/rechazar Reprogramaciones queda solo para Administrador y
// Administrador Máster — un operador puede solicitarlas pero no aprobarlas.
// Ver también ProgramacionClient.tsx, que ni siquiera muestra la opción
// "Reprogramaciones pendientes" a quien no tenga uno de estos dos roles.
async function requireAdminPresupuesto(): Promise<{ error: string } | { uid: number; esMaster: boolean }> {
  const moduloCheck = await requireModuloAccessAction("mod_presupuesto");
  if ("error" in moduloCheck) return moduloCheck;
  const session = await auth();
  if (session?.user.rol !== "admin" && session?.user.rol !== "superadmin") {
    return { error: "Solo un Administrador puede aprobar o rechazar Reprogramaciones" };
  }
  return { ...moduloCheck, esMaster: session.user.rol === "superadmin" };
}

export type SubproductoDisponible = {
  renglon: number;
  descripcion: string;
  subProducto: string;
  vigente: number;
};

/** Busca renglones por coincidencia de número (para el buscador). */
export async function buscarRenglones(query: string): Promise<SubproductoDisponible[]> {
  const q = query.trim();
  if (q === "") return [];
  return PRESUPUESTO_DATA.filter(r => String(r.renglon).includes(q));
}

/** Todos los sub-productos asociados a un renglón específico. */
export async function getSubproductosDeRenglon(renglon: number): Promise<SubproductoDisponible[]> {
  return PRESUPUESTO_DATA.filter(r => r.renglon === renglon);
}

export type GrupoConTotales = {
  id: number;
  label: string;
  min: number;
  max: number;
  totalVigente: number;
};

/** Los 3 grupos (rangos de renglón) con su monto total vigente. */
export async function getGrupos(): Promise<GrupoConTotales[]> {
  return GRUPOS.map(g => ({
    ...g,
    totalVigente: PRESUPUESTO_DATA
      .filter(r => r.renglon >= g.min && r.renglon <= g.max)
      .reduce((sum, r) => sum + r.vigente, 0),
  }));
}

/** Suma ya programada (Normal + Regularizado) en un grupo para un cuatrimestre — el tope es 33.33% del vigente total del grupo. */
export async function getProgramadoDelGrupo(cuatrimestre: number, grupoId: number): Promise<number> {
  const grupo = GRUPOS.find(g => g.id === grupoId);
  if (!grupo) return 0;
  const filas = await db.select({
    renglon: programacionEntradas.renglon,
    mes1: programacionEntradas.mes1, mes2: programacionEntradas.mes2,
    mes3: programacionEntradas.mes3, mes4: programacionEntradas.mes4,
  }).from(programacionEntradas).where(and(
    eq(programacionEntradas.ejercicio_fiscal, EJERCICIO),
    eq(programacionEntradas.cuatrimestre, cuatrimestre),
    sql`${programacionEntradas.estado} != 'Caducado'`,
  ));
  return filas
    .filter(f => f.renglon >= grupo.min && f.renglon <= grupo.max)
    .reduce((sum, f) => sum + f.mes1 + f.mes2 + f.mes3 + f.mes4, 0);
}

export type ProgramacionEntrada = {
  id: number;
  cuatrimestre: number;
  renglon: number;
  descripcion: string;
  subProducto: string;
  tipo: "normal" | "regularizado";
  mes1: number;
  mes2: number;
  mes3: number;
  mes4: number;
  total: number;
  estado: string;
};

/**
 * Entradas ya guardadas para un cuatrimestre (para la tabla de "ya
 * programados" / impresión) — no incluye lo que esté "Borrador" (lotes de
 * Reprogramación todavía en construcción, sin solicitar), ver
 * getLoteBorrador para eso.
 */
export async function getEntradas(cuatrimestre: number): Promise<ProgramacionEntrada[]> {
  await procesarCierreCuatrimestres();

  const filas = await db.select().from(programacionEntradas).where(and(
    eq(programacionEntradas.ejercicio_fiscal, EJERCICIO),
    eq(programacionEntradas.cuatrimestre, cuatrimestre),
    sql`${programacionEntradas.estado} != 'Borrador'`,
  )).orderBy(programacionEntradas.renglon);

  const porClave = new Map(PRESUPUESTO_DATA.map(r => [`${r.renglon}|${r.subProducto}`, r]));

  return filas.map(f => {
    const base = porClave.get(`${f.renglon}|${f.subproducto}`);
    return {
      id: f.id,
      cuatrimestre: f.cuatrimestre,
      renglon: f.renglon,
      descripcion: base?.descripcion ?? "",
      subProducto: f.subproducto,
      tipo: f.tipo as "normal" | "regularizado",
      mes1: f.mes1, mes2: f.mes2, mes3: f.mes3, mes4: f.mes4,
      total: f.mes1 + f.mes2 + f.mes3 + f.mes4,
      estado: f.estado,
    };
  });
}

export type GuardarEntradaInput = {
  cuatrimestre: number;
  renglon: number;
  subProducto: string;
  tipo: "normal" | "regularizado";
  mes1: number;
  mes2: number;
  mes3: number;
  mes4: number;
  modo: "programacion" | "reprogramacion";
};

/** Busca el lote Borrador abierto del cuatrimestre, o crea uno nuevo si no hay. */
async function obtenerOCrearLoteBorrador(cuatrimestre: number, uid: number): Promise<number> {
  const [abierto] = await db.select({ id: reprogramacionLotes.id }).from(reprogramacionLotes).where(and(
    eq(reprogramacionLotes.ejercicio_fiscal, EJERCICIO),
    eq(reprogramacionLotes.cuatrimestre, cuatrimestre),
    eq(reprogramacionLotes.estado, "Borrador"),
  )).limit(1);
  if (abierto) return abierto.id;

  const [nuevo] = await db.insert(reprogramacionLotes).values({
    ejercicio_fiscal: EJERCICIO, cuatrimestre, estado: "Borrador", creado_por: uid,
  }).returning({ id: reprogramacionLotes.id });
  return nuevo.id;
}

/**
 * Guarda (Programación) o actualiza (Reprogramación) el monto mensual de un
 * renglón/sub-producto/tipo dentro de un cuatrimestre. Valida que la suma
 * de todo lo programado en el grupo (rango de renglón) para ese cuatrimestre
 * no supere el 33.33% del monto vigente total del grupo, y que no se le
 * asigne/cambie dinero a un mes que ya terminó (para esos meses se conserva
 * lo que ya hubiera, ignorando lo que mande el cliente).
 *
 * Programación sigue siendo fila por fila (Solicitado -> Aprobado). Una
 * Reprogramación no se solicita ni aprueba fila por fila: cada guardado
 * queda "Borrador" dentro del lote abierto de este cuatrimestre (ver
 * obtenerOCrearLoteBorrador) — recién al llamar solicitarLote() se
 * solicitan todas las filas del lote juntas, y aprobarLote/rechazarLote
 * deciden sobre el lote completo.
 */
export async function guardarEntrada(input: GuardarEntradaInput): Promise<{ ok: true } | { error: string }> {
  const check = await requireEdit();
  if ("error" in check) return check;

  const { cuatrimestre, renglon, subProducto, tipo, modo } = input;
  if (![1, 2, 3].includes(cuatrimestre)) return { error: "Cuatrimestre inválido" };
  if (tipo !== "normal" && tipo !== "regularizado") return { error: "Tipo inválido" };

  const hoy = fechaGuatemala();
  if (modo === "programacion" && !ventanaProgramacionAbierta(cuatrimestre, hoy)) {
    return { error: `La Programación del cuatrimestre ${cuatrimestre} solo se puede crear/editar durante los primeros 5 días hábiles de ${mesCreacionProgramacionLabel(cuatrimestre)}.` };
  }
  // Reprogramación no tiene ventana de fecha para solicitarse — se puede
  // cualquier día del año (solo se bloquea al momento de aprobar el lote).

  const base = PRESUPUESTO_DATA.find(r => r.renglon === renglon && r.subProducto === subProducto);
  if (!base) return { error: "El renglón/sub-producto no existe en el catálogo presupuestario" };

  const grupo = grupoDeRenglon(renglon);
  if (!grupo) return { error: "El renglón no pertenece a ningún grupo válido" };

  const [existente] = await db.select().from(programacionEntradas).where(and(
    eq(programacionEntradas.ejercicio_fiscal, EJERCICIO),
    eq(programacionEntradas.cuatrimestre, cuatrimestre),
    eq(programacionEntradas.renglon, renglon),
    eq(programacionEntradas.subproducto, subProducto),
    eq(programacionEntradas.tipo, tipo),
  )).limit(1);

  if (modo === "programacion" && existente) {
    return { error: "Este renglón/sub-producto ya fue programado en este cuatrimestre. Use Reprogramación para modificarlo." };
  }
  // Reprogramación sí puede crear la entrada si todavía no existe — regla
  // confirmada con el cliente: sirve para asignarle presupuesto por primera
  // vez a un renglón dentro de un cuatrimestre ya en curso (ej. combustible
  // para una planta eléctrica, imprevisto que no se programó al inicio).

  // Un mes que ya pasó no se puede asignar/cambiar — se conserva lo que ya
  // hubiera ahí (0 si la fila es nueva), sin importar lo que mande el cliente.
  const mesesInput = [input.mes1, input.mes2, input.mes3, input.mes4] as const;
  const mesesExistentes = existente ? [existente.mes1, existente.mes2, existente.mes3, existente.mes4] as const : null;
  const [mes1, mes2, mes3, mes4] = mesesInput.map((valor, i) => {
    const indice = i + 1;
    if (mesDelCuatrimestreYaPaso(cuatrimestre, indice, hoy)) return mesesExistentes ? mesesExistentes[i] : 0;
    return Math.max(0, valor || 0);
  });
  const nuevoTotal = mes1 + mes2 + mes3 + mes4;
  if (nuevoTotal <= 0) return { error: "Debe ingresar al menos un monto mayor a cero en un mes que no haya pasado todavía" };

  const totalGrupo = PRESUPUESTO_DATA
    .filter(r => r.renglon >= grupo.min && r.renglon <= grupo.max)
    .reduce((sum, r) => sum + r.vigente, 0);
  const tope = totalGrupo / 3;

  const yaProgramado = await getProgramadoDelGrupo(cuatrimestre, grupo.id);
  const totalPrevioDeEstaFila = existente ? existente.mes1 + existente.mes2 + existente.mes3 + existente.mes4 : 0;
  const proyectado = yaProgramado - totalPrevioDeEstaFila + nuevoTotal;

  if (proyectado > tope + 0.01) {
    const disponible = Math.max(0, tope - (yaProgramado - totalPrevioDeEstaFila));
    return {
      error: `Supera el 33.33% del grupo ${grupo.label} para este cuatrimestre. Disponible: Q${disponible.toLocaleString("es-GT", { minimumFractionDigits: 2 })}`,
    };
  }

  const estadoNuevo = modo === "programacion" ? "Solicitado" : "Borrador";
  const loteId = modo === "reprogramacion" ? await obtenerOCrearLoteBorrador(cuatrimestre, check.uid) : null;

  if (existente) {
    // Al reprogramar, la solicitud vuelve a Borrador (dentro de un lote)
    // aunque ya estuviera Aprobada, para que pase de nuevo por aprobación.
    await db.update(programacionEntradas).set({
      mes1, mes2, mes3, mes4,
      estado: estadoNuevo,
      origen: modo,
      lote_id: loteId,
      updated_at: sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`,
    }).where(eq(programacionEntradas.id, existente.id));
  } else {
    await db.insert(programacionEntradas).values({
      ejercicio_fiscal: EJERCICIO,
      cuatrimestre, renglon, subproducto: subProducto, tipo,
      mes1, mes2, mes3, mes4,
      estado: estadoNuevo,
      origen: modo,
      lote_id: loteId,
      creado_por: check.uid,
    });
  }

  return { ok: true };
}

// Ventana de aprobación de una entrada de Programación, según el mes en que
// se creó/editó por última vez (ver fechaAprobacionAutomatica en
// programacion-fechas.ts): abre ese día y queda abierta indefinidamente
// después (no hay fecha límite para que Presupuesto la revise). Solo aplica
// a Programación — Reprogramación usa su propia ventana recurrente (ver
// ventanaAprobacionReprogramacionAbierta), que no depende de cuándo se
// solicitó.
function ventanaAprobacionProgramacionAbierta(updatedAt: string | null): boolean {
  const hoy = fechaGuatemala();
  const fechaBase = updatedAt ?? hoy;
  const anio = Number(fechaBase.slice(0, 4));
  const mes = Number(fechaBase.slice(5, 7));
  return hoy >= fechaAprobacionAutomatica(anio, mes);
}

/**
 * Aprueba una entrada de Programación — solo quien tenga acceso a
 * mod_presupuesto, y solo dentro de su ventana de aprobación (abre el 6to
 * día hábil del mes en que se creó, sin límite después). Reprogramación no
 * se aprueba fila por fila — ver aprobarLote.
 *
 * Único caso especial: el Administrador Máster (superadmin) puede aprobar
 * cualquier día del año, sin ventana — pero si está fuera de fecha, primero
 * se le devuelve `fueraDeVentana` para que el cliente le muestre una
 * confirmación ("no estás en fechas permitidas, ¿de verdad deseas
 * continuar?"); solo al reintentar con `forzar: true` se aprueba de una vez.
 */
export async function aprobarEntrada(id: number, forzar = false): Promise<{ ok: true } | { error: string; fueraDeVentana?: true }> {
  const check = await requireAdminPresupuesto();
  if ("error" in check) return check;

  const [fila] = await db.select({
    estado: programacionEntradas.estado,
    updated_at: programacionEntradas.updated_at,
    origen: programacionEntradas.origen,
  }).from(programacionEntradas).where(eq(programacionEntradas.id, id)).limit(1);
  if (!fila) return { error: "No existe esa entrada" };
  if (fila.origen === "reprogramacion") return { error: "Esta Reprogramación se aprueba junto con todo su lote — ve a Reprogramaciones pendientes." };
  if (fila.estado !== "Solicitado") return { error: "Esta entrada ya no está pendiente de aprobación" };
  if (!ventanaAprobacionProgramacionAbierta(fila.updated_at)) {
    if (!check.esMaster) {
      return { error: "Todavía no se puede aprobar esta entrada — espera a que abra su ventana de aprobación." };
    }
    if (!forzar) {
      return { error: "Estás fuera de las fechas permitidas para aprobar esta entrada. ¿De verdad deseas continuar?", fueraDeVentana: true };
    }
  }

  await db.update(programacionEntradas).set({ estado: "Aprobado" }).where(eq(programacionEntradas.id, id));
  return { ok: true };
}

/** Rechaza una entrada de Programación mientras siga "Solicitado" — solo quien tenga acceso a mod_presupuesto. Reprogramación se rechaza por lote — ver rechazarLote. */
export async function rechazarEntrada(id: number): Promise<{ ok: true } | { error: string }> {
  const check = await requireAdminPresupuesto();
  if ("error" in check) return check;

  const [fila] = await db.select({ estado: programacionEntradas.estado, origen: programacionEntradas.origen })
    .from(programacionEntradas).where(eq(programacionEntradas.id, id)).limit(1);
  if (!fila) return { error: "No existe esa entrada" };
  if (fila.origen === "reprogramacion") return { error: "Esta Reprogramación se rechaza junto con todo su lote — ve a Reprogramaciones pendientes." };
  if (fila.estado !== "Solicitado") return { error: "Ya no se puede rechazar: la entrada dejó de estar Solicitada" };

  await db.update(programacionEntradas).set({
    estado: "Rechazado",
    updated_at: sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`,
  }).where(eq(programacionEntradas.id, id));

  return { ok: true };
}

/**
 * Elimina una entrada mientras se pueda seguir editando: Programación
 * mientras siga "Solicitado", Reprogramación mientras su lote siga
 * "Borrador" (para corregir errores antes de solicitar/aprobar). Si era la
 * última fila del lote, el lote vacío también se elimina.
 */
export async function eliminarEntrada(id: number): Promise<{ ok: true } | { error: string }> {
  const check = await requireEdit();
  if ("error" in check) return check;

  const [fila] = await db.select({ estado: programacionEntradas.estado, origen: programacionEntradas.origen, lote_id: programacionEntradas.lote_id })
    .from(programacionEntradas).where(eq(programacionEntradas.id, id)).limit(1);
  if (!fila) return { error: "No existe esa entrada" };
  const estadoEditable = fila.origen === "reprogramacion" ? "Borrador" : "Solicitado";
  if (fila.estado !== estadoEditable) {
    return { error: fila.origen === "reprogramacion" ? "Ya no se puede eliminar: este lote ya fue solicitado" : "Ya no se puede eliminar: la entrada dejó de estar Solicitada" };
  }

  await db.delete(programacionEntradas).where(eq(programacionEntradas.id, id));

  if (fila.lote_id) {
    const [{ restantes }] = await db.select({ restantes: sql<number>`count(*)` })
      .from(programacionEntradas).where(eq(programacionEntradas.lote_id, fila.lote_id));
    if (Number(restantes) === 0) {
      await db.delete(reprogramacionLotes).where(eq(reprogramacionLotes.id, fila.lote_id));
    }
  }

  return { ok: true };
}

export type LoteReprogramacion = {
  id: number;
  cuatrimestre: number;
  estado: string;
  filas: ProgramacionEntrada[];
};

async function cargarLote(loteId: number): Promise<LoteReprogramacion | null> {
  const [lote] = await db.select().from(reprogramacionLotes).where(eq(reprogramacionLotes.id, loteId)).limit(1);
  if (!lote) return null;
  const filas = await db.select().from(programacionEntradas).where(eq(programacionEntradas.lote_id, loteId)).orderBy(programacionEntradas.renglon);
  const porClave = new Map(PRESUPUESTO_DATA.map(r => [`${r.renglon}|${r.subProducto}`, r]));
  return {
    id: lote.id,
    cuatrimestre: lote.cuatrimestre,
    estado: lote.estado,
    filas: filas.map(f => ({
      id: f.id, cuatrimestre: f.cuatrimestre, renglon: f.renglon,
      descripcion: porClave.get(`${f.renglon}|${f.subproducto}`)?.descripcion ?? "",
      subProducto: f.subproducto, tipo: f.tipo as "normal" | "regularizado",
      mes1: f.mes1, mes2: f.mes2, mes3: f.mes3, mes4: f.mes4,
      total: f.mes1 + f.mes2 + f.mes3 + f.mes4, estado: f.estado,
    })),
  };
}

/** Lote Borrador abierto (si hay) de este cuatrimestre, con todo lo que se ha ido armando renglón por renglón. */
export async function getLoteBorrador(cuatrimestre: number): Promise<LoteReprogramacion | null> {
  const [abierto] = await db.select({ id: reprogramacionLotes.id }).from(reprogramacionLotes).where(and(
    eq(reprogramacionLotes.ejercicio_fiscal, EJERCICIO),
    eq(reprogramacionLotes.cuatrimestre, cuatrimestre),
    eq(reprogramacionLotes.estado, "Borrador"),
  )).limit(1);
  if (!abierto) return null;
  return cargarLote(abierto.id);
}

/** Todos los lotes de Reprogramación Solicitados (pendientes de aprobación), más recientes primero. */
export async function getLotesPendientes(): Promise<LoteReprogramacion[]> {
  const lotes = await db.select({ id: reprogramacionLotes.id }).from(reprogramacionLotes).where(and(
    eq(reprogramacionLotes.ejercicio_fiscal, EJERCICIO),
    eq(reprogramacionLotes.estado, "Solicitado"),
  )).orderBy(sql`${reprogramacionLotes.id} DESC`);
  const cargados = await Promise.all(lotes.map(l => cargarLote(l.id)));
  return cargados.filter((l): l is LoteReprogramacion => l !== null);
}

/** Envía todo el lote Borrador (todas sus filas juntas) a aprobación — desde aquí ya no se puede seguir editando fila por fila hasta que se apruebe o se rechace. */
export async function solicitarLote(loteId: number): Promise<{ ok: true } | { error: string }> {
  const check = await requireEdit();
  if ("error" in check) return check;

  const [lote] = await db.select({ estado: reprogramacionLotes.estado }).from(reprogramacionLotes).where(eq(reprogramacionLotes.id, loteId)).limit(1);
  if (!lote) return { error: "No existe ese lote" };
  if (lote.estado !== "Borrador") return { error: "Este lote ya fue solicitado" };

  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(programacionEntradas).where(eq(programacionEntradas.lote_id, loteId));
  if (Number(total) === 0) return { error: "Agrega al menos un renglón antes de solicitar" };

  await db.update(programacionEntradas).set({ estado: "Solicitado" }).where(and(
    eq(programacionEntradas.lote_id, loteId),
    eq(programacionEntradas.estado, "Borrador"),
  ));
  await db.update(reprogramacionLotes).set({
    estado: "Solicitado",
    updated_at: sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`,
  }).where(eq(reprogramacionLotes.id, loteId));

  return { ok: true };
}

/**
 * Aprueba un lote completo de Reprogramación — solo Administrador/Administrador
 * Máster, y solo dentro de la ventana (primeros 5 días hábiles de cada mes).
 * Aprueba todas sus filas juntas.
 *
 * Único caso especial: el Administrador Máster (superadmin) puede aprobar
 * cualquier día del año, sin ventana — pero si está fuera de fecha, primero
 * se le devuelve `fueraDeVentana` para que el cliente le muestre una
 * confirmación; solo al reintentar con `forzar: true` se aprueba de una vez.
 */
export async function aprobarLote(loteId: number, forzar = false): Promise<{ ok: true } | { error: string; fueraDeVentana?: true }> {
  const check = await requireAdminPresupuesto();
  if ("error" in check) return check;

  const [lote] = await db.select({ estado: reprogramacionLotes.estado }).from(reprogramacionLotes).where(eq(reprogramacionLotes.id, loteId)).limit(1);
  if (!lote) return { error: "No existe ese lote" };
  if (lote.estado !== "Solicitado") return { error: "Este lote ya no está pendiente de aprobación" };
  if (!ventanaAprobacionReprogramacionAbierta(fechaGuatemala())) {
    if (!check.esMaster) {
      return { error: "Las Reprogramaciones solo se pueden aprobar durante los primeros 5 días hábiles de cada mes." };
    }
    if (!forzar) {
      return { error: "Estás fuera de las fechas permitidas para aprobar este lote. ¿De verdad deseas continuar?", fueraDeVentana: true };
    }
  }

  await db.update(programacionEntradas).set({ estado: "Aprobado" }).where(and(
    eq(programacionEntradas.lote_id, loteId),
    eq(programacionEntradas.estado, "Solicitado"),
  ));
  await db.update(reprogramacionLotes).set({
    estado: "Aprobado",
    updated_at: sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`,
  }).where(eq(reprogramacionLotes.id, loteId));

  return { ok: true };
}

/** Rechaza un lote completo — solo Administrador/Administrador Máster. No lo elimina: lo regresa entero a Borrador para que se pueda corregir la fila mala (fila por fila) y volver a solicitar, sin perder las demás. */
export async function rechazarLote(loteId: number): Promise<{ ok: true } | { error: string }> {
  const check = await requireAdminPresupuesto();
  if ("error" in check) return check;

  const [lote] = await db.select({ estado: reprogramacionLotes.estado }).from(reprogramacionLotes).where(eq(reprogramacionLotes.id, loteId)).limit(1);
  if (!lote) return { error: "No existe ese lote" };
  if (lote.estado !== "Solicitado") return { error: "Este lote ya no está pendiente de aprobación" };

  await db.update(programacionEntradas).set({ estado: "Borrador" }).where(and(
    eq(programacionEntradas.lote_id, loteId),
    eq(programacionEntradas.estado, "Solicitado"),
  ));
  await db.update(reprogramacionLotes).set({
    estado: "Borrador",
    updated_at: sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`,
  }).where(eq(reprogramacionLotes.id, loteId));

  return { ok: true };
}

export type GuardarModificacionInput = {
  tipo: TipoModificacion;
  renglon: number;
  subProducto: string;
  valor: number;
};

/**
 * Reprogramación: registra la SOLICITUD de una modificación (Ingru /
 * Ampliación) para un renglón + sub-producto — se puede solicitar cualquier
 * día del año. Queda "Solicitado" y NO toca presupuesto_renglones todavía;
 * eso solo pasa al aprobar (ver aprobarModificacion, que además solo se
 * puede hacer del 15 al 20 de cada mes), que SUMA este valor al acumulado
 * del año (puede ser negativo para registrar que se le quitó presupuesto a
 * ese renglón).
 */
export async function guardarModificacion(input: GuardarModificacionInput): Promise<{ ok: true } | { error: string }> {
  const check = await requireEdit();
  if ("error" in check) return check;

  const tipoInfo = TIPOS_MODIFICACION.find(t => t.id === input.tipo);
  if (!tipoInfo) return { error: "Tipo de modificación inválido" };

  const base = PRESUPUESTO_DATA.find(r => r.renglon === input.renglon && r.subProducto === input.subProducto);
  if (!base) return { error: "El renglón/sub-producto no existe en el catálogo presupuestario" };

  const valor = input.valor || 0;

  const [existente] = await db.select({ id: modificacionesPresupuestarias.id })
    .from(modificacionesPresupuestarias)
    .where(and(
      eq(modificacionesPresupuestarias.ejercicio_fiscal, EJERCICIO),
      eq(modificacionesPresupuestarias.tipo, input.tipo),
      eq(modificacionesPresupuestarias.renglon, input.renglon),
      eq(modificacionesPresupuestarias.subproducto, input.subProducto),
    )).limit(1);

  if (existente) {
    await db.update(modificacionesPresupuestarias).set({
      valor, estado: "Solicitado",
      updated_at: sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`,
    }).where(eq(modificacionesPresupuestarias.id, existente.id));
  } else {
    await db.insert(modificacionesPresupuestarias).values({
      ejercicio_fiscal: EJERCICIO,
      tipo: input.tipo, renglon: input.renglon, subproducto: input.subProducto,
      valor, estado: "Solicitado", creado_por: check.uid,
    });
  }

  return { ok: true };
}

/**
 * Aprueba una modificación Ingru/Ampliación — solo quien tenga acceso a
 * mod_presupuesto, y solo del 15 al 20 de cada mes. Recién aquí se refleja
 * en presupuesto_renglones, SUMANDO (o restando, si el valor aprobado es
 * negativo) al acumulado del año — igual que ya hace
 * modificacion_entre_renglones vía transferirPresupuesto.
 */
export async function aprobarModificacion(id: number): Promise<{ ok: true } | { error: string }> {
  const check = await requireModuloAccessAction("mod_presupuesto");
  if ("error" in check) return check;

  const [fila] = await db.select().from(modificacionesPresupuestarias)
    .where(eq(modificacionesPresupuestarias.id, id)).limit(1);
  if (!fila) return { error: "No existe esa modificación" };
  if (fila.estado !== "Solicitado") return { error: "Esta modificación ya no está pendiente de aprobación" };
  if (!ventanaAprobacionModificacionAbierta(fechaGuatemala())) {
    return { error: "Las Modificaciones (Ingru/Ampliación) solo se pueden aprobar del 15 al 20 de cada mes." };
  }

  const tipoInfo = TIPOS_MODIFICACION.find(t => t.id === fila.tipo);
  if (!tipoInfo) return { error: "Tipo de modificación inválido" };

  const [existente] = await db.select({ id: presupuestoRenglones.id })
    .from(presupuestoRenglones)
    .where(and(
      eq(presupuestoRenglones.ejercicio_fiscal, EJERCICIO),
      eq(presupuestoRenglones.renglon, fila.renglon),
      eq(presupuestoRenglones.subproducto, fila.subproducto),
    )).limit(1);

  if (existente) {
    await db.update(presupuestoRenglones)
      .set({ [tipoInfo.campo]: sql`COALESCE(${presupuestoRenglones[tipoInfo.campo]}, 0) + ${fila.valor}` })
      .where(eq(presupuestoRenglones.id, existente.id));
  } else {
    const base = PRESUPUESTO_DATA.find(r => r.renglon === fila.renglon && r.subProducto === fila.subproducto);
    await db.insert(presupuestoRenglones).values({
      ejercicio_fiscal: EJERCICIO,
      renglon: fila.renglon,
      subproducto: fila.subproducto,
      nombre: base?.descripcion ?? "",
      vigente: base?.vigente ?? null,
      [tipoInfo.campo]: fila.valor,
    });
  }

  await db.update(modificacionesPresupuestarias).set({ estado: "Aprobado" }).where(eq(modificacionesPresupuestarias.id, id));
  return { ok: true };
}

/** Rechaza una modificación Ingru/Ampliación mientras siga "Solicitado" — solo quien tenga acceso a mod_presupuesto. */
export async function rechazarModificacion(id: number): Promise<{ ok: true } | { error: string }> {
  const check = await requireModuloAccessAction("mod_presupuesto");
  if ("error" in check) return check;

  const [fila] = await db.select({ estado: modificacionesPresupuestarias.estado })
    .from(modificacionesPresupuestarias).where(eq(modificacionesPresupuestarias.id, id)).limit(1);
  if (!fila) return { error: "No existe esa modificación" };
  if (fila.estado !== "Solicitado") return { error: "Ya no se puede rechazar: dejó de estar Solicitada" };

  await db.update(modificacionesPresupuestarias).set({
    estado: "Rechazado",
    updated_at: sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`,
  }).where(eq(modificacionesPresupuestarias.id, id));

  return { ok: true };
}

export type ModificacionRow = {
  id: number;
  renglon: number;
  descripcion: string;
  subProducto: string;
  tipo: TipoModificacion;
  valor: number;
  estado: string;
};

/** Modificaciones Ingru/Ampliación registradas (Solicitado/Aprobado/Rechazado), para la tabla de "ya modificados". */
export async function getModificaciones(): Promise<ModificacionRow[]> {
  const filas = await db.select().from(modificacionesPresupuestarias)
    .where(eq(modificacionesPresupuestarias.ejercicio_fiscal, EJERCICIO))
    .orderBy(sql`id DESC`);

  const porClave = new Map(PRESUPUESTO_DATA.map(r => [`${r.renglon}|${r.subProducto}`, r]));

  return filas.map(f => {
    const base = porClave.get(`${f.renglon}|${f.subproducto}`);
    return {
      id: f.id,
      renglon: f.renglon,
      descripcion: base?.descripcion ?? "",
      subProducto: f.subproducto,
      tipo: f.tipo as TipoModificacion,
      valor: f.valor,
      estado: f.estado,
    };
  });
}

export type SubproductoConDisponible = SubproductoDisponible & { saldo: number };

/** Sub-productos de un renglón con su Saldo real (Vigente + Modificaciones − lo ya programado en todo el año) — lo único que se puede transferir a otro renglón. */
export async function getSubproductosConDisponible(renglon: number): Promise<SubproductoConDisponible[]> {
  const subs = await getSubproductosDeRenglon(renglon);
  return Promise.all(subs.map(async s => {
    const { saldo } = await getSaldoRenglon(renglon, s.subProducto);
    return { ...s, saldo };
  }));
}

export type TransferenciaInput = {
  renglonOrigen: number;
  subProductoOrigen: string;
  renglonDestino: number;
  subProductoDestino: string;
  monto: number;
  motivo?: string;
};

async function sumarModificacionEntreRenglones(renglon: number, subProducto: string, delta: number): Promise<void> {
  const [existente] = await db.select({ id: presupuestoRenglones.id })
    .from(presupuestoRenglones)
    .where(and(
      eq(presupuestoRenglones.ejercicio_fiscal, EJERCICIO),
      eq(presupuestoRenglones.renglon, renglon),
      eq(presupuestoRenglones.subproducto, subProducto),
    )).limit(1);

  if (existente) {
    await db.update(presupuestoRenglones).set({
      modificacion_entre_renglones: sql`COALESCE(${presupuestoRenglones.modificacion_entre_renglones}, 0) + ${delta}`,
    }).where(eq(presupuestoRenglones.id, existente.id));
  } else {
    const base = PRESUPUESTO_DATA.find(r => r.renglon === renglon && r.subProducto === subProducto);
    await db.insert(presupuestoRenglones).values({
      ejercicio_fiscal: EJERCICIO,
      renglon, subproducto: subProducto,
      nombre: base?.descripcion ?? "",
      vigente: base?.vigente ?? null,
      modificacion_entre_renglones: delta,
    });
  }
}

/**
 * Reprogramación por transferencia real: registra la SOLICITUD de mover
 * `monto` del renglón/sub-producto de origen al de destino — se puede
 * solicitar cualquier día del año. Valida que el origen tenga saldo
 * disponible suficiente para no comprometer más de lo que hay, pero NO
 * mueve nada todavía — queda "Solicitado" en `reprogramaciones`; el
 * movimiento real a presupuesto_renglones ocurre solo al aprobar (ver
 * aprobarTransferencia, que además solo se puede hacer del 15 al 20 de
 * cada mes).
 */
export async function transferirPresupuesto(input: TransferenciaInput): Promise<{ ok: true } | { error: string }> {
  const check = await requireEdit();
  if ("error" in check) return check;

  const { renglonOrigen, subProductoOrigen, renglonDestino, subProductoDestino, motivo } = input;

  const monto = input.monto || 0;
  if (!(monto > 0)) return { error: "Ingresa un monto válido" };
  if (renglonOrigen === renglonDestino && subProductoOrigen === subProductoDestino) {
    return { error: "El origen y el destino no pueden ser el mismo renglón/sub-producto" };
  }

  const baseOrigen = PRESUPUESTO_DATA.find(r => r.renglon === renglonOrigen && r.subProducto === subProductoOrigen);
  if (!baseOrigen) return { error: "El renglón/sub-producto de origen no existe en el catálogo presupuestario" };
  const baseDestino = PRESUPUESTO_DATA.find(r => r.renglon === renglonDestino && r.subProducto === subProductoDestino);
  if (!baseDestino) return { error: "El renglón/sub-producto de destino no existe en el catálogo presupuestario" };

  const { saldo } = await getSaldoRenglon(renglonOrigen, subProductoOrigen);
  if (monto > saldo + 0.01) {
    return {
      error: `El origen (renglón ${renglonOrigen} / ${subProductoOrigen}) solo tiene Q${saldo.toLocaleString("es-GT", { minimumFractionDigits: 2 })} en Saldo para transferir — lo ya programado en algún cuatrimestre no se puede mover a otro renglón`,
    };
  }

  await db.insert(reprogramaciones).values({
    ejercicio_fiscal: EJERCICIO,
    fecha: fechaGuatemala(),
    renglon_origen: renglonOrigen, subproducto_origen: subProductoOrigen,
    renglon_destino: renglonDestino, subproducto_destino: subProductoDestino,
    monto, motivo: motivo?.trim() || null,
    estado: "Solicitado",
    creado_por: check.uid,
  });

  return { ok: true };
}

/**
 * Aprueba una transferencia — solo quien tenga acceso a mod_presupuesto, y
 * solo del 15 al 20 de cada mes. Vuelve a validar que el origen siga
 * teniendo saldo disponible suficiente (pudo cambiar desde que se solicitó)
 * antes de mover el dinero.
 */
export async function aprobarTransferencia(id: number): Promise<{ ok: true } | { error: string }> {
  const check = await requireModuloAccessAction("mod_presupuesto");
  if ("error" in check) return check;

  const [fila] = await db.select().from(reprogramaciones).where(eq(reprogramaciones.id, id)).limit(1);
  if (!fila) return { error: "No existe esa transferencia" };
  if (fila.estado !== "Solicitado") return { error: "Esta transferencia ya no está pendiente de aprobación" };
  if (!ventanaAprobacionModificacionAbierta(fechaGuatemala())) {
    return { error: "Las Transferencias entre renglón/sub-producto solo se pueden aprobar del 15 al 20 de cada mes." };
  }

  const { saldo } = await getSaldoRenglon(fila.renglon_origen, fila.subproducto_origen);
  if (fila.monto > saldo + 0.01) {
    return {
      error: `El origen (renglón ${fila.renglon_origen} / ${fila.subproducto_origen}) ya no tiene suficiente Saldo (Q${saldo.toLocaleString("es-GT", { minimumFractionDigits: 2 })}) para aprobar esta transferencia`,
    };
  }

  await sumarModificacionEntreRenglones(fila.renglon_origen, fila.subproducto_origen, -fila.monto);
  await sumarModificacionEntreRenglones(fila.renglon_destino, fila.subproducto_destino, fila.monto);

  await db.update(reprogramaciones).set({ estado: "Aprobado" }).where(eq(reprogramaciones.id, id));
  return { ok: true };
}

/** Rechaza una transferencia mientras siga "Solicitado" — solo quien tenga acceso a mod_presupuesto. */
export async function rechazarTransferencia(id: number): Promise<{ ok: true } | { error: string }> {
  const check = await requireModuloAccessAction("mod_presupuesto");
  if ("error" in check) return check;

  const [fila] = await db.select({ estado: reprogramaciones.estado })
    .from(reprogramaciones).where(eq(reprogramaciones.id, id)).limit(1);
  if (!fila) return { error: "No existe esa transferencia" };
  if (fila.estado !== "Solicitado") return { error: "Ya no se puede rechazar: dejó de estar Solicitada" };

  await db.update(reprogramaciones).set({
    estado: "Rechazado",
    updated_at: sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`,
  }).where(eq(reprogramaciones.id, id));

  return { ok: true };
}

export type TransferenciaRow = {
  id: number; fecha: string;
  renglonOrigen: number; subProductoOrigen: string;
  renglonDestino: number; subProductoDestino: string;
  monto: number; motivo: string | null;
  estado: string;
};

/** Historial de transferencias registradas en el ejercicio fiscal actual (más recientes primero). */
export async function getTransferencias(): Promise<TransferenciaRow[]> {
  const filas = await db.select().from(reprogramaciones)
    .where(eq(reprogramaciones.ejercicio_fiscal, EJERCICIO))
    .orderBy(sql`id DESC`);
  return filas.map(f => ({
    id: f.id, fecha: f.fecha,
    renglonOrigen: f.renglon_origen, subProductoOrigen: f.subproducto_origen,
    renglonDestino: f.renglon_destino, subProductoDestino: f.subproducto_destino,
    monto: f.monto, motivo: f.motivo,
    estado: f.estado,
  }));
}
