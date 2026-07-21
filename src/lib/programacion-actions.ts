"use server";
import { db } from "@/lib/db";
import { programacionEntradas } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { PRESUPUESTO_DATA } from "@/lib/presupuesto-general-data";
import { GRUPOS, grupoDeRenglon } from "@/lib/programacion-constants";

const EJERCICIO = 2026;

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
};

/** Entradas ya guardadas para un cuatrimestre (para la tabla de "ya programados"). */
export async function getEntradas(cuatrimestre: number): Promise<ProgramacionEntrada[]> {
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
    await db.update(programacionEntradas).set({
      mes1, mes2, mes3, mes4,
      updated_at: sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`,
    }).where(eq(programacionEntradas.id, existente.id));
  } else {
    await db.insert(programacionEntradas).values({
      ejercicio_fiscal: EJERCICIO,
      cuatrimestre, renglon, subproducto: subProducto, tipo,
      mes1, mes2, mes3, mes4,
      creado_por: check.uid,
    });
  }

  return { ok: true };
}
