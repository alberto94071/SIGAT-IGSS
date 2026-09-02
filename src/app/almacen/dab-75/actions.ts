"use server";
import { db } from "@/lib/db";
import { requisicionesBodega, requisicionBodegaItems, requisicionBodegaDespachos, almacenInsumos, almacenLotes } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";
import { fechaHoraGuatemala } from "@/lib/date-utils";

export type InsumoParaHistorial = { id: number; codigo_igss: string | null; nombre: string };

// Todos los insumos que alguna vez tuvieron un ingreso (no solo los que
// tienen existencia ahora) — para el selector de "Descargar historial" en
// Almacén/Archivo/DAB-75, donde interesa poder consultar el historial
// completo aunque ya no quede nada disponible.
export async function getInsumosParaHistorial(): Promise<InsumoParaHistorial[]> {
  const session = await auth();
  if (!session) return [];
  return db.select({ id: almacenInsumos.id, codigo_igss: almacenInsumos.codigo_igss, nombre: almacenInsumos.nombre })
    .from(almacenInsumos)
    .orderBy(almacenInsumos.nombre);
}

// Items con la descripción completa del insumo (nombre + características)
// vía almacenInsumos.descripcion_igss — requisicionBodegaItems solo guarda un
// snapshot de codigo/nombre corto, insuficiente para que el encargado
// distinga presentaciones al revisar/aprobar (mismo fix que el lado
// colaborador, ver solicitar-insumos/actions.ts; reportado por el cliente
// 2026-09-02).
async function itemsConDescripcion(requisicionId: number) {
  return db.select({
    id: requisicionBodegaItems.id, codigo: requisicionBodegaItems.codigo, nombre: requisicionBodegaItems.nombre,
    cantidad_solicitada: requisicionBodegaItems.cantidad_solicitada, insumo_id: requisicionBodegaItems.insumo_id,
    descripcion_igss: almacenInsumos.descripcion_igss,
  }).from(requisicionBodegaItems)
    .leftJoin(almacenInsumos, eq(almacenInsumos.id, requisicionBodegaItems.insumo_id))
    .where(eq(requisicionBodegaItems.requisicion_id, requisicionId))
    .orderBy(requisicionBodegaItems.orden);
}

// Para Almacén/Archivo → DAB-75: solo lo ya resuelto (Aprobado o
// Rechazado) — una solicitud "Pendiente" todavía vive en la bandeja de
// almacen/dab-75, no en el archivo. Los "Borrador" son carritos del
// colaborador todavía en progreso, tampoco le corresponden al archivo.
export async function getRequisiciones() {
  const session = await auth();
  if (!session) return [];
  const rows = await db.select().from(requisicionesBodega)
    .where(sql`${requisicionesBodega.estado} IN ('Aprobado', 'Rechazado')`)
    .orderBy(sql`id DESC`);
  return Promise.all(rows.map(async r => ({
    ...r,
    items: await itemsConDescripcion(r.id),
  })));
}

export async function getRequisicion(id: number) {
  const session = await auth();
  if (!session) return null;
  const [r] = await db.select().from(requisicionesBodega).where(eq(requisicionesBodega.id, id)).limit(1);
  if (!r) return null;
  const items = await db.select().from(requisicionBodegaItems)
    .where(eq(requisicionBodegaItems.requisicion_id, id))
    .orderBy(requisicionBodegaItems.orden);
  return { ...r, items };
}

// Bandeja de Almacén/DAB-75 — solo lo Pendiente de revisar. En cuanto se
// aprueba o rechaza, la solicitud sale de acá y pasa a Almacén/Archivo →
// DAB-75 (ver getRequisiciones) — el cliente pidió que esta bandeja sea
// solo la cola de trabajo activa, no un historial (2026-08-27).
export async function getSolicitudesAlmacen() {
  const session = await auth();
  if (!session) return [];
  const rows = await db.select().from(requisicionesBodega)
    .where(eq(requisicionesBodega.estado, "Pendiente"))
    .orderBy(sql`id DESC`);
  return Promise.all(rows.map(async r => ({
    ...r,
    items: await itemsConDescripcion(r.id),
  })));
}

// Se despacha por FEFO (First-Expire-First-Out): el lote que vence antes se
// agota primero, y el que vence después queda bloqueado hasta que el
// anterior se termine — así nunca sale primero un insumo que vence más
// tarde mientras quede stock de uno que vence antes. Los lotes sin fecha de
// vencimiento (ej. papelería) caen al final y se despachan FIFO entre ellos
// (confirmado por el cliente 2026-08-26). Antes esto corría al CREAR la
// requisición; ahora corre al APROBAR — una solicitud "Pendiente" no
// compromete stock todavía, porque el encargado puede cambiar cantidades
// antes de aprobar.
class StockInsuficienteEnTransaccion extends Error {
  constructor(public nombre: string, public disponible: number, public requerido: number) {
    super("stock_insuficiente_en_transaccion");
  }
}

async function despacharItemFEFO(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  item: { id: number; insumo_id: number; nombre: string; cantidad_solicitada: number }
) {
  const lotesDisponibles = await tx.select().from(almacenLotes)
    .where(and(eq(almacenLotes.insumo_id, item.insumo_id), sql`${almacenLotes.cantidad_disponible} > 0`))
    .orderBy(sql`${almacenLotes.fecha_vencimiento} ASC NULLS LAST`, almacenLotes.fecha_ingreso);

  const totalDisponible = lotesDisponibles.reduce((s, l) => s + l.cantidad_disponible, 0);
  if (totalDisponible < item.cantidad_solicitada) {
    throw new StockInsuficienteEnTransaccion(item.nombre, totalDisponible, item.cantidad_solicitada);
  }

  let restante = item.cantidad_solicitada;
  for (const lote of lotesDisponibles) {
    if (restante <= 0) break;
    const tomar = Math.min(lote.cantidad_disponible, restante);
    await tx.update(almacenLotes)
      .set({ cantidad_disponible: sql`${almacenLotes.cantidad_disponible} - ${tomar}` })
      .where(eq(almacenLotes.id, lote.id));
    await tx.insert(requisicionBodegaDespachos).values({
      requisicion_item_id: item.id, lote_id: lote.id, cantidad: tomar,
    });
    restante -= tomar;
  }
}

export type DatosAprobacion = {
  no_pedido: string;
  clave_administrativa: string;
  bodega: "I" | "II";
  fecha_despacho: string;
  entrega_nombre: string;
  entrega_no_empleado: string;
  entrega_cargo: string;
  recibe_nombre: string;
  recibe_no_empleado: string;
  recibe_cargo: string;
  director_nombre: string;
  items: { id: number; cantidad_solicitada: number }[];
};

// El encargado de Almacén revisa la solicitud Pendiente que armó el
// colaborador: puede ajustar las cantidades de cada ítem (a su discreción) y
// completa los datos administrativos que el colaborador no llena (No. de
// Pedido, Clave Administrativa, Bodega, Entrega, Recibe, Director). Recién
// acá se descuenta stock de verdad (FEFO).
export async function aprobarSolicitud(id: number, datos: DatosAprobacion): Promise<{ ok: true } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

  if (!datos.no_pedido.trim()) return { error: "El No. de Pedido es obligatorio" };
  if (!datos.clave_administrativa.trim()) return { error: "La Clave Administrativa es obligatoria" };
  if (datos.bodega !== "I" && datos.bodega !== "II") return { error: "Debe indicar Bodega I o Bodega II" };
  if (datos.items.some(it => !(it.cantidad_solicitada > 0))) return { error: "Las cantidades deben ser mayores a cero" };

  try {
    await db.transaction(async (tx) => {
      const [req] = await tx.select().from(requisicionesBodega).where(eq(requisicionesBodega.id, id)).limit(1);
      if (!req || req.estado !== "Pendiente") throw new Error("Esta solicitud ya no está pendiente de revisión");

      const itemsActuales = await tx.select().from(requisicionBodegaItems).where(eq(requisicionBodegaItems.requisicion_id, id));

      for (const edicion of datos.items) {
        const item = itemsActuales.find(i => i.id === edicion.id);
        if (!item || !item.insumo_id) continue;
        await tx.update(requisicionBodegaItems).set({ cantidad_solicitada: edicion.cantidad_solicitada }).where(eq(requisicionBodegaItems.id, item.id));
        await despacharItemFEFO(tx, { id: item.id, insumo_id: item.insumo_id, nombre: item.nombre, cantidad_solicitada: edicion.cantidad_solicitada });
      }

      await tx.update(requisicionesBodega).set({
        estado: "Aprobado",
        aprobado_por: Number(session.user.id),
        aprobado_en: fechaHoraGuatemala(),
        no_pedido: datos.no_pedido.trim(),
        clave_administrativa: datos.clave_administrativa.trim(),
        bodega: datos.bodega,
        fecha_despacho: datos.fecha_despacho || null,
        entrega_nombre: datos.entrega_nombre.trim() || null,
        entrega_no_empleado: datos.entrega_no_empleado.trim() || null,
        entrega_cargo: datos.entrega_cargo.trim() || null,
        recibe_nombre: datos.recibe_nombre.trim() || null,
        recibe_no_empleado: datos.recibe_no_empleado.trim() || null,
        recibe_cargo: datos.recibe_cargo.trim() || null,
        director_nombre: datos.director_nombre.trim() || null,
      }).where(eq(requisicionesBodega.id, id));
    });

    return { ok: true };
  } catch (e) {
    if (e instanceof StockInsuficienteEnTransaccion) {
      return { error: `Solo hay ${e.disponible.toLocaleString("es-GT")} disponible(s) de "${e.nombre}" (se pidieron ${e.requerido.toLocaleString("es-GT")}).` };
    }
    if (e instanceof Error && e.message === "Esta solicitud ya no está pendiente de revisión") return { error: e.message };
    return { error: "Error al aprobar la solicitud" };
  }
}

export async function rechazarSolicitud(id: number, motivo: string): Promise<{ ok: true } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  if (!motivo.trim()) return { error: "Indicá el motivo del rechazo" };

  const [req] = await db.select().from(requisicionesBodega).where(eq(requisicionesBodega.id, id)).limit(1);
  if (!req || req.estado !== "Pendiente") return { error: "Esta solicitud ya no está pendiente de revisión" };

  await db.update(requisicionesBodega).set({
    estado: "Rechazado",
    rechazado_por: Number(session.user.id),
    rechazado_en: fechaHoraGuatemala(),
    motivo_rechazo: motivo.trim(),
  }).where(eq(requisicionesBodega.id, id));

  return { ok: true };
}
