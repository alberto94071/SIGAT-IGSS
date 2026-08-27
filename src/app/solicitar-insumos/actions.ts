"use server";
import { db } from "@/lib/db";
import { requisicionesBodega, requisicionBodegaItems, almacenInsumos, almacenLotes, usuarios } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";
import { fechaGuatemala } from "@/lib/date-utils";

async function getMeColaborador() {
  const session = await auth();
  if (!session || session.user.rol !== "colaborador") return null;
  return { id: Number(session.user.id) };
}

async function disponibleDe(insumoId: number): Promise<number> {
  const [row] = await db.select({
    disponible: sql<number>`coalesce(sum(${almacenLotes.cantidad_disponible}), 0)`,
  }).from(almacenLotes).where(eq(almacenLotes.insumo_id, insumoId));
  return row?.disponible ?? 0;
}

// Encuentra el "carrito" en progreso del colaborador (estado "Borrador") o lo
// crea si es el primer insumo que agrega — un colaborador solo tiene un
// borrador activo a la vez.
async function getOCrearBorrador(colaboradorId: number) {
  const [existente] = await db.select().from(requisicionesBodega)
    .where(and(eq(requisicionesBodega.creado_por, colaboradorId), eq(requisicionesBodega.estado, "Borrador")))
    .limit(1);
  if (existente) return existente;

  const [nuevo] = await db.insert(requisicionesBodega).values({
    creado_por: colaboradorId,
    estado: "Borrador",
  }).returning();
  return nuevo;
}

export async function agregarInsumoASolicitud(insumoId: number, cantidad: number): Promise<{ ok: true } | { error: string }> {
  const me = await getMeColaborador();
  if (!me) return { error: "No autorizado" };
  if (!(cantidad > 0)) return { error: "La cantidad debe ser mayor a cero" };

  const [insumo] = await db.select().from(almacenInsumos).where(eq(almacenInsumos.id, insumoId)).limit(1);
  if (!insumo) return { error: "Insumo no encontrado" };

  const borrador = await getOCrearBorrador(me.id);

  const [existente] = await db.select().from(requisicionBodegaItems)
    .where(and(eq(requisicionBodegaItems.requisicion_id, borrador.id), eq(requisicionBodegaItems.insumo_id, insumoId)))
    .limit(1);

  const disponible = await disponibleDe(insumoId);
  const nuevaCantidad = (existente?.cantidad_solicitada ?? 0) + cantidad;
  if (nuevaCantidad > disponible) {
    return { error: `Solo hay ${disponible.toLocaleString("es-GT")} disponible(s) de "${insumo.nombre}"${existente ? ` (ya tenés ${existente.cantidad_solicitada.toLocaleString("es-GT")} en tu solicitud)` : ""}.` };
  }

  if (existente) {
    await db.update(requisicionBodegaItems).set({ cantidad_solicitada: nuevaCantidad }).where(eq(requisicionBodegaItems.id, existente.id));
  } else {
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(requisicionBodegaItems)
      .where(eq(requisicionBodegaItems.requisicion_id, borrador.id));
    if (total >= 14) return { error: "Tu solicitud ya tiene el máximo de 14 insumos distintos" };
    await db.insert(requisicionBodegaItems).values({
      requisicion_id: borrador.id, codigo: insumo.codigo_igss ?? "S/C", nombre: insumo.nombre,
      cantidad_solicitada: cantidad, orden: total, insumo_id: insumoId,
    });
  }

  return { ok: true };
}

async function itemDelColaborador(itemId: number, colaboradorId: number) {
  const [row] = await db.select({ item: requisicionBodegaItems, req: requisicionesBodega }).from(requisicionBodegaItems)
    .innerJoin(requisicionesBodega, eq(requisicionesBodega.id, requisicionBodegaItems.requisicion_id))
    .where(eq(requisicionBodegaItems.id, itemId)).limit(1);
  if (!row || row.req.creado_por !== colaboradorId || row.req.estado !== "Borrador") return null;
  return row;
}

export async function actualizarItemBorrador(itemId: number, cantidad: number): Promise<{ ok: true } | { error: string }> {
  const me = await getMeColaborador();
  if (!me) return { error: "No autorizado" };
  if (!(cantidad > 0)) return { error: "La cantidad debe ser mayor a cero" };

  const row = await itemDelColaborador(itemId, me.id);
  if (!row) return { error: "No encontrado" };

  const disponible = await disponibleDe(row.item.insumo_id!);
  if (cantidad > disponible) {
    return { error: `Solo hay ${disponible.toLocaleString("es-GT")} disponible(s) de "${row.item.nombre}".` };
  }

  await db.update(requisicionBodegaItems).set({ cantidad_solicitada: cantidad }).where(eq(requisicionBodegaItems.id, itemId));
  return { ok: true };
}

export async function eliminarItemBorrador(itemId: number): Promise<{ ok: true } | { error: string }> {
  const me = await getMeColaborador();
  if (!me) return { error: "No autorizado" };

  const row = await itemDelColaborador(itemId, me.id);
  if (!row) return { error: "No encontrado" };

  await db.delete(requisicionBodegaItems).where(eq(requisicionBodegaItems.id, itemId));
  return { ok: true };
}

export async function getMiSolicitudActiva() {
  const me = await getMeColaborador();
  if (!me) return null;

  const [borrador] = await db.select().from(requisicionesBodega)
    .where(and(eq(requisicionesBodega.creado_por, me.id), eq(requisicionesBodega.estado, "Borrador")))
    .limit(1);
  if (!borrador) return null;

  const items = await db.select().from(requisicionBodegaItems)
    .where(eq(requisicionBodegaItems.requisicion_id, borrador.id))
    .orderBy(requisicionBodegaItems.orden);
  return { ...borrador, items };
}

export async function getMisSolicitudes() {
  const me = await getMeColaborador();
  if (!me) return [];

  const rows = await db.select().from(requisicionesBodega)
    .where(and(eq(requisicionesBodega.creado_por, me.id), sql`${requisicionesBodega.estado} != 'Borrador'`))
    .orderBy(sql`id DESC`);
  return Promise.all(rows.map(async r => ({
    ...r,
    items: await db.select().from(requisicionBodegaItems)
      .where(eq(requisicionBodegaItems.requisicion_id, r.id))
      .orderBy(requisicionBodegaItems.orden),
  })));
}

// Pasa el borrador (carrito) a "Pendiente" — a partir de acá el encargado de
// Almacén la revisa en almacen/dab-75; el colaborador ya no puede editarla.
// El resto de los campos administrativos (No. de Pedido, Bodega, etc.) los
// llena el encargado al aprobar, no el colaborador.
export async function enviarSolicitud(borradorId: number, salaServicio: string): Promise<{ ok: true } | { error: string }> {
  const me = await getMeColaborador();
  if (!me) return { error: "No autorizado" };
  if (!salaServicio.trim()) return { error: "Indicá tu Sala o Servicio" };

  const [borrador] = await db.select().from(requisicionesBodega).where(eq(requisicionesBodega.id, borradorId)).limit(1);
  if (!borrador || borrador.creado_por !== me.id || borrador.estado !== "Borrador") return { error: "Solicitud no encontrada" };

  const items = await db.select().from(requisicionBodegaItems).where(eq(requisicionBodegaItems.requisicion_id, borradorId));
  if (items.length === 0) return { error: "Agregá al menos un insumo a tu solicitud" };

  for (const it of items) {
    const disponible = await disponibleDe(it.insumo_id!);
    if (it.cantidad_solicitada > disponible) {
      return { error: `Ya no hay suficiente disponible de "${it.nombre}" — ajustá la cantidad antes de solicitar.` };
    }
  }

  const [perfil] = await db.select().from(usuarios).where(eq(usuarios.id, me.id)).limit(1);
  if (!perfil) return { error: "No se encontró tu perfil" };

  await db.update(requisicionesBodega).set({
    estado: "Pendiente",
    fecha_emision: fechaGuatemala(),
    sala_servicio: salaServicio.trim(),
    solicita_nombre: perfil.nombre,
    solicita_no_empleado: perfil.ibm ?? "",
    solicita_cargo: perfil.puesto_nominal ?? "",
  }).where(eq(requisicionesBodega.id, borradorId));

  return { ok: true };
}
