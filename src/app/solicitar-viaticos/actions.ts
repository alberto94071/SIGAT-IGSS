"use server";
import { db } from "@/lib/db";
import { viaticoSolicitudes } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { and, eq, sql } from "drizzle-orm";

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
