"use server";
import { fechaGuatemala } from "@/lib/date-utils";
import { db } from "@/lib/db";
import { programacionEntradas, presupuestoRenglones, reprogramaciones } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { PRESUPUESTO_DATA } from "@/lib/presupuesto-general-data";
import { GRUPOS, grupoDeRenglon, TIPOS_MODIFICACION, type TipoModificacion } from "@/lib/programacion-constants";
import { getDisponible, EJERCICIO_FISCAL } from "@/lib/presupuesto-disponible";
import {
  ventanaProgramacionAbierta, ventanaReprogramacionAbierta,
  mesCreacionProgramacionLabel, mesesReprogramacionLabel, fechaAprobacionAutomatica,
  ventanaIngruAbierta, ventanaTransferenciaAbierta, ventanaAmpliacionAbierta,
} from "@/lib/programacion-fechas";
import { procesarCierreCuatrimestres } from "@/lib/cierre-cuatrimestre";

const EJERCICIO = EJERCICIO_FISCAL;

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
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

// Aprobación automática por fecha: no hay cron en este proyecto, así que
// cada vez que se listan entradas se revisan las que siguen "Solicitado" y
// se aprueban las que ya cumplieron su fecha de aprobación automática (ver
// programacion-fechas.ts). Efecto equivalente a un job diario, sin infraestructura extra.
async function aprobarSolicitudesVencidas(cuatrimestre: number): Promise<void> {
  const hoy = fechaGuatemala();
  const pendientes = await db.select({ id: programacionEntradas.id, updated_at: programacionEntradas.updated_at })
    .from(programacionEntradas).where(and(
      eq(programacionEntradas.ejercicio_fiscal, EJERCICIO),
      eq(programacionEntradas.cuatrimestre, cuatrimestre),
      eq(programacionEntradas.estado, "Solicitado"),
    ));

  for (const p of pendientes) {
    const fechaBase = p.updated_at ?? hoy;
    const anio = Number(fechaBase.slice(0, 4));
    const mes = Number(fechaBase.slice(5, 7));
    if (hoy >= fechaAprobacionAutomatica(anio, mes)) {
      await db.update(programacionEntradas).set({ estado: "Aprobado" }).where(eq(programacionEntradas.id, p.id));
    }
  }
}

/** Entradas ya guardadas para un cuatrimestre (para la tabla de "ya programados"). */
export async function getEntradas(cuatrimestre: number): Promise<ProgramacionEntrada[]> {
  await procesarCierreCuatrimestres();
  await aprobarSolicitudesVencidas(cuatrimestre);

  const filas = await db.select().from(programacionEntradas).where(and(
    eq(programacionEntradas.ejercicio_fiscal, EJERCICIO),
    eq(programacionEntradas.cuatrimestre, cuatrimestre),
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

/**
 * Guarda (Programación) o actualiza (Reprogramación) el monto mensual de un
 * renglón/sub-producto/tipo dentro de un cuatrimestre. Valida que la suma
 * de todo lo programado en el grupo (rango de renglón) para ese cuatrimestre
 * no supere el 33.33% del monto vigente total del grupo.
 */
export async function guardarEntrada(input: GuardarEntradaInput): Promise<{ ok: true } | { error: string }> {
  const check = await requireEdit();
  if ("error" in check) return check;

  const { cuatrimestre, renglon, subProducto, tipo, modo } = input;
  if (![1, 2, 3].includes(cuatrimestre)) return { error: "Cuatrimestre inválido" };
  if (tipo !== "normal" && tipo !== "regularizado") return { error: "Tipo inválido" };

  const hoy = fechaGuatemala();
  if (modo === "programacion") {
    if (!ventanaProgramacionAbierta(cuatrimestre, hoy)) {
      return { error: `La Programación del cuatrimestre ${cuatrimestre} solo se puede crear/editar durante los primeros 5 días hábiles de ${mesCreacionProgramacionLabel(cuatrimestre)}.` };
    }
  } else {
    if (!ventanaReprogramacionAbierta(hoy)) {
      return { error: `La Reprogramación solo se puede crear/editar durante los primeros 5 días hábiles de: ${mesesReprogramacionLabel()}.` };
    }
  }

  const base = PRESUPUESTO_DATA.find(r => r.renglon === renglon && r.subProducto === subProducto);
  if (!base) return { error: "El renglón/sub-producto no existe en el catálogo presupuestario" };

  const grupo = grupoDeRenglon(renglon);
  if (!grupo) return { error: "El renglón no pertenece a ningún grupo válido" };

  const mes1 = Math.max(0, input.mes1 || 0);
  const mes2 = Math.max(0, input.mes2 || 0);
  const mes3 = Math.max(0, input.mes3 || 0);
  const mes4 = Math.max(0, input.mes4 || 0);
  const nuevoTotal = mes1 + mes2 + mes3 + mes4;
  if (nuevoTotal <= 0) return { error: "Debe ingresar al menos un monto mayor a cero" };

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
  if (modo === "reprogramacion" && !existente) {
    return { error: "No existe una programación previa para reprogramar. Use Programación para crearla." };
  }

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

  if (existente) {
    // Solo llega aquí vía Reprogramación (Programación nunca actualiza una
    // fila existente, ver validación arriba) — al reprogramar, la solicitud
    // vuelve a "Solicitado" aunque ya estuviera Aprobada, para que pase de
    // nuevo por la aprobación automática.
    await db.update(programacionEntradas).set({
      mes1, mes2, mes3, mes4,
      estado: "Solicitado",
      updated_at: sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`,
    }).where(eq(programacionEntradas.id, existente.id));
  } else {
    await db.insert(programacionEntradas).values({
      ejercicio_fiscal: EJERCICIO,
      cuatrimestre, renglon, subproducto: subProducto, tipo,
      mes1, mes2, mes3, mes4,
      estado: "Solicitado",
      creado_por: check.uid,
    });
  }

  return { ok: true };
}

/** Rechaza una entrada de Programación/Reprogramación mientras siga "Solicitado". */
export async function rechazarEntrada(id: number): Promise<{ ok: true } | { error: string }> {
  const check = await requireEdit();
  if ("error" in check) return check;

  const [fila] = await db.select({ estado: programacionEntradas.estado })
    .from(programacionEntradas).where(eq(programacionEntradas.id, id)).limit(1);
  if (!fila) return { error: "No existe esa entrada" };
  if (fila.estado !== "Solicitado") return { error: "Ya no se puede rechazar: la entrada dejó de estar Solicitada" };

  await db.update(programacionEntradas).set({
    estado: "Rechazado",
    updated_at: sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`,
  }).where(eq(programacionEntradas.id, id));

  return { ok: true };
}

/** Elimina una entrada de Programación/Reprogramación mientras siga "Solicitado" (para corregir errores). */
export async function eliminarEntrada(id: number): Promise<{ ok: true } | { error: string }> {
  const check = await requireEdit();
  if ("error" in check) return check;

  const [fila] = await db.select({ estado: programacionEntradas.estado })
    .from(programacionEntradas).where(eq(programacionEntradas.id, id)).limit(1);
  if (!fila) return { error: "No existe esa entrada" };
  if (fila.estado !== "Solicitado") return { error: "Ya no se puede eliminar: la entrada dejó de estar Solicitada" };

  await db.delete(programacionEntradas).where(eq(programacionEntradas.id, id));

  return { ok: true };
}

export type GuardarModificacionInput = {
  tipo: TipoModificacion;
  renglon: number;
  subProducto: string;
  valor: number;
};

/**
 * Reprogramación: fija el valor de una modificación (Ingru / Entre
 * Renglones / Ampliación) para un renglón + sub-producto. No suma al valor
 * anterior — lo reemplaza tal cual, sea que ya existiera un valor o no.
 */
export async function guardarModificacion(input: GuardarModificacionInput): Promise<{ ok: true } | { error: string }> {
  const check = await requireEdit();
  if ("error" in check) return check;

  const tipoInfo = TIPOS_MODIFICACION.find(t => t.id === input.tipo);
  if (!tipoInfo) return { error: "Tipo de modificación inválido" };

  const hoy = fechaGuatemala();
  if (input.tipo === "ingru" && !ventanaIngruAbierta(hoy)) {
    return { error: "La Modificación tipo Ingru solo se puede registrar el 1er o 2do día hábil de cada mes (de febrero a diciembre)." };
  }
  if (input.tipo === "ampliacion" && !ventanaAmpliacionAbierta(hoy)) {
    return { error: "La Modificación de Ampliación solo se puede registrar en abril, julio o septiembre." };
  }

  const base = PRESUPUESTO_DATA.find(r => r.renglon === input.renglon && r.subProducto === input.subProducto);
  if (!base) return { error: "El renglón/sub-producto no existe en el catálogo presupuestario" };

  const valor = input.valor || 0;

  const [existente] = await db.select({ id: presupuestoRenglones.id })
    .from(presupuestoRenglones)
    .where(and(
      eq(presupuestoRenglones.ejercicio_fiscal, EJERCICIO),
      eq(presupuestoRenglones.renglon, input.renglon),
      eq(presupuestoRenglones.subproducto, input.subProducto),
    )).limit(1);

  if (existente) {
    await db.update(presupuestoRenglones)
      .set({ [tipoInfo.campo]: valor })
      .where(eq(presupuestoRenglones.id, existente.id));
  } else {
    await db.insert(presupuestoRenglones).values({
      ejercicio_fiscal: EJERCICIO,
      renglon: input.renglon,
      subproducto: input.subProducto,
      nombre: base.descripcion,
      vigente: base.vigente,
      [tipoInfo.campo]: valor,
    });
  }

  return { ok: true };
}

export type ModificacionRow = {
  renglon: number;
  descripcion: string;
  subProducto: string;
  ingru: number;
  entreRenglones: number;
  ampliacion: number;
};

/** Renglones/sub-productos con alguna modificación distinta de cero (para la tabla de "ya modificados"). */
export async function getModificaciones(): Promise<ModificacionRow[]> {
  const filas = await db.select({
    renglon:      presupuestoRenglones.renglon,
    subproducto:  presupuestoRenglones.subproducto,
    ingru:        presupuestoRenglones.modificacion_ingru,
    entre_renglones: presupuestoRenglones.modificacion_entre_renglones,
    ampliacion:   presupuestoRenglones.modificacion_ampliacion,
  }).from(presupuestoRenglones).where(eq(presupuestoRenglones.ejercicio_fiscal, EJERCICIO));

  const porClave = new Map(PRESUPUESTO_DATA.map(r => [`${r.renglon}|${r.subProducto}`, r]));

  return filas
    .filter(f => f.ingru !== 0 || f.entre_renglones !== 0 || f.ampliacion !== 0)
    .map(f => {
      const base = porClave.get(`${f.renglon}|${f.subproducto}`);
      return {
        renglon: f.renglon as number,
        descripcion: base?.descripcion ?? "",
        subProducto: f.subproducto as string,
        ingru: f.ingru,
        entreRenglones: f.entre_renglones,
        ampliacion: f.ampliacion,
      };
    })
    .sort((a, b) => a.renglon - b.renglon);
}

export type SubproductoConDisponible = SubproductoDisponible & { disponible: number };

/** Sub-productos de un renglón con su presupuesto realmente disponible (programado + modificaciones − ya usado). */
export async function getSubproductosConDisponible(renglon: number): Promise<SubproductoConDisponible[]> {
  const subs = await getSubproductosDeRenglon(renglon);
  return Promise.all(subs.map(async s => {
    const { disponible } = await getDisponible(renglon, s.subProducto);
    return { ...s, disponible };
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
 * Reprogramación por transferencia real: quita `monto` del presupuesto
 * disponible del renglón/sub-producto de origen y lo suma al de destino.
 * Valida que el origen tenga saldo disponible suficiente antes de mover
 * nada (nunca deja el origen en negativo), y deja un registro de auditoría
 * en `reprogramaciones`.
 */
export async function transferirPresupuesto(input: TransferenciaInput): Promise<{ ok: true } | { error: string }> {
  const check = await requireEdit();
  if ("error" in check) return check;

  const { renglonOrigen, subProductoOrigen, renglonDestino, subProductoDestino, motivo } = input;

  if (!ventanaTransferenciaAbierta(fechaGuatemala())) {
    return { error: "La Transferencia entre renglón/sub-producto solo se puede registrar del 15 al 20 de cada mes (de febrero a diciembre)." };
  }

  const monto = input.monto || 0;
  if (!(monto > 0)) return { error: "Ingresa un monto válido" };
  if (renglonOrigen === renglonDestino && subProductoOrigen === subProductoDestino) {
    return { error: "El origen y el destino no pueden ser el mismo renglón/sub-producto" };
  }

  const baseOrigen = PRESUPUESTO_DATA.find(r => r.renglon === renglonOrigen && r.subProducto === subProductoOrigen);
  if (!baseOrigen) return { error: "El renglón/sub-producto de origen no existe en el catálogo presupuestario" };
  const baseDestino = PRESUPUESTO_DATA.find(r => r.renglon === renglonDestino && r.subProducto === subProductoDestino);
  if (!baseDestino) return { error: "El renglón/sub-producto de destino no existe en el catálogo presupuestario" };

  const { disponible } = await getDisponible(renglonOrigen, subProductoOrigen);
  if (monto > disponible + 0.01) {
    return {
      error: `El origen (renglón ${renglonOrigen} / ${subProductoOrigen}) solo tiene Q${disponible.toLocaleString("es-GT", { minimumFractionDigits: 2 })} disponibles para transferir`,
    };
  }

  await sumarModificacionEntreRenglones(renglonOrigen, subProductoOrigen, -monto);
  await sumarModificacionEntreRenglones(renglonDestino, subProductoDestino, monto);

  await db.insert(reprogramaciones).values({
    ejercicio_fiscal: EJERCICIO,
    fecha: fechaGuatemala(),
    renglon_origen: renglonOrigen, subproducto_origen: subProductoOrigen,
    renglon_destino: renglonDestino, subproducto_destino: subProductoDestino,
    monto, motivo: motivo?.trim() || null,
    creado_por: check.uid,
  });

  return { ok: true };
}

export type TransferenciaRow = {
  id: number; fecha: string;
  renglonOrigen: number; subProductoOrigen: string;
  renglonDestino: number; subProductoDestino: string;
  monto: number; motivo: string | null;
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
  }));
}
