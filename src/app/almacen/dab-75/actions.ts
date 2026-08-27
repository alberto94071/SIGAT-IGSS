"use server";
import { db } from "@/lib/db";
import { requisicionesBodega, requisicionBodegaItems, requisicionBodegaDespachos, almacenInsumos, almacenLotes } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";

export type ItemRequisicion = { insumo_id: number; cantidad_solicitada: number };

export type InsumoConExistencia = {
  id: number; codigo_igss: string | null; nombre: string; unidad_medida: string | null;
  cantidad_disponible: number;
};

// Insumos con existencia > 0, para el selector del modal "Nueva Requisición"
// — no se puede despachar lo que no está en el Catálogo de Almacén (el
// encargado solo puede dar lo que ya ingresó físicamente vía DAB-60).
export async function getInsumosConExistencia(): Promise<InsumoConExistencia[]> {
  const session = await auth();
  if (!session) return [];
  const rows = await db.select({
    id: almacenInsumos.id, codigo_igss: almacenInsumos.codigo_igss, nombre: almacenInsumos.nombre,
    unidad_medida: almacenInsumos.unidad_medida,
    cantidad_disponible: sql<number>`coalesce(sum(${almacenLotes.cantidad_disponible}), 0)`,
  }).from(almacenInsumos)
    .innerJoin(almacenLotes, eq(almacenLotes.insumo_id, almacenInsumos.id))
    .groupBy(almacenInsumos.id)
    .having(sql`coalesce(sum(${almacenLotes.cantidad_disponible}), 0) > 0`)
    .orderBy(almacenInsumos.nombre);
  return rows;
}

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

// Se despacha por FEFO (First-Expire-First-Out): el lote que vence antes se
// agota primero, y el que vence después queda bloqueado hasta que el
// anterior se termine — así nunca sale primero un insumo que vence más
// tarde mientras quede stock de uno que vence antes. Los lotes sin fecha de
// vencimiento (ej. papelería) caen al final y se despachan FIFO entre ellos
// (confirmado por el cliente 2026-08-26).
class StockInsuficienteEnTransaccion extends Error {
  constructor(public nombre: string, public disponible: number, public requerido: number) {
    super("stock_insuficiente_en_transaccion");
  }
}

export type NuevaRequisicionData = {
  no_pedido: string;
  fecha_emision: string;
  clave_administrativa: string;
  sala_servicio: string;
  bodega: "I" | "II";
  fecha_despacho: string;
  solicita_nombre: string;
  solicita_no_empleado: string;
  solicita_cargo: string;
  entrega_nombre: string;
  entrega_no_empleado: string;
  entrega_cargo: string;
  recibe_nombre: string;
  recibe_no_empleado: string;
  recibe_cargo: string;
  director_nombre: string;
  items: ItemRequisicion[];
};

export async function getRequisiciones() {
  const session = await auth();
  if (!session) return [];
  const rows = await db.select().from(requisicionesBodega).orderBy(sql`id DESC`);
  return Promise.all(rows.map(async r => ({
    ...r,
    items: await db.select().from(requisicionBodegaItems)
      .where(eq(requisicionBodegaItems.requisicion_id, r.id))
      .orderBy(requisicionBodegaItems.orden),
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

export async function crearRequisicion(data: NuevaRequisicionData): Promise<{ ok: true; id: number } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

  if (!data.no_pedido.trim()) return { error: "El No. de Pedido es obligatorio" };
  if (!data.fecha_emision) return { error: "La Fecha de Emisión es obligatoria" };
  if (!data.clave_administrativa.trim()) return { error: "La Clave Administrativa es obligatoria" };
  if (!data.sala_servicio.trim()) return { error: "La Sala o Servicio es obligatoria" };
  if (data.bodega !== "I" && data.bodega !== "II") return { error: "Debe indicar Bodega I o Bodega II" };
  if (!data.solicita_nombre.trim() || !data.solicita_no_empleado.trim() || !data.solicita_cargo.trim()) {
    return { error: "Los datos de quien Solicita son obligatorios" };
  }
  const items = data.items.filter(i => i.insumo_id && i.cantidad_solicitada > 0);
  if (items.length === 0) return { error: "Debe agregar al menos un insumo" };
  if (items.length > 14) return { error: "Máximo 14 insumos por requisición (espacio de la hoja)" };

  try {
    let requisicionId = 0;

    await db.transaction(async (tx) => {
      const [row] = await tx.insert(requisicionesBodega).values({
        no_pedido: data.no_pedido.trim(),
        fecha_emision: data.fecha_emision,
        clave_administrativa: data.clave_administrativa.trim(),
        sala_servicio: data.sala_servicio.trim(),
        bodega: data.bodega,
        fecha_despacho: data.fecha_despacho || null,
        solicita_nombre: data.solicita_nombre.trim(),
        solicita_no_empleado: data.solicita_no_empleado.trim(),
        solicita_cargo: data.solicita_cargo.trim(),
        entrega_nombre: data.entrega_nombre.trim() || null,
        entrega_no_empleado: data.entrega_no_empleado.trim() || null,
        entrega_cargo: data.entrega_cargo.trim() || null,
        recibe_nombre: data.recibe_nombre.trim() || null,
        recibe_no_empleado: data.recibe_no_empleado.trim() || null,
        recibe_cargo: data.recibe_cargo.trim() || null,
        director_nombre: data.director_nombre.trim() || null,
        creado_por: Number(session.user.id),
      }).returning({ id: requisicionesBodega.id });
      requisicionId = row.id;

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const [insumo] = await tx.select().from(almacenInsumos).where(eq(almacenInsumos.id, it.insumo_id)).limit(1);
        if (!insumo) throw new Error(`No se encontró el insumo seleccionado`);

        const [itemRow] = await tx.insert(requisicionBodegaItems).values({
          requisicion_id: requisicionId,
          codigo: insumo.codigo_igss ?? "S/C",
          nombre: insumo.nombre,
          cantidad_solicitada: it.cantidad_solicitada,
          orden: i,
          insumo_id: insumo.id,
        }).returning({ id: requisicionBodegaItems.id });

        // Re-lee los lotes con la fila bloqueada dentro de la transacción
        // (no confía en lo que el cliente vio al abrir el modal) — dos
        // requisiciones simultáneas del mismo insumo no pueden sobre-
        // despachar. FEFO: fecha_vencimiento ASC (los sin vencimiento caen
        // al final, FIFO por fecha_ingreso entre ellos).
        const lotesDisponibles = await tx.select().from(almacenLotes)
          .where(and(eq(almacenLotes.insumo_id, insumo.id), sql`${almacenLotes.cantidad_disponible} > 0`))
          .orderBy(sql`${almacenLotes.fecha_vencimiento} ASC NULLS LAST`, almacenLotes.fecha_ingreso);

        const totalDisponible = lotesDisponibles.reduce((s, l) => s + l.cantidad_disponible, 0);
        if (totalDisponible < it.cantidad_solicitada) {
          throw new StockInsuficienteEnTransaccion(insumo.nombre, totalDisponible, it.cantidad_solicitada);
        }

        let restante = it.cantidad_solicitada;
        for (const lote of lotesDisponibles) {
          if (restante <= 0) break;
          const tomar = Math.min(lote.cantidad_disponible, restante);
          await tx.update(almacenLotes)
            .set({ cantidad_disponible: sql`${almacenLotes.cantidad_disponible} - ${tomar}` })
            .where(eq(almacenLotes.id, lote.id));
          await tx.insert(requisicionBodegaDespachos).values({
            requisicion_item_id: itemRow.id, lote_id: lote.id, cantidad: tomar,
          });
          restante -= tomar;
        }
      }
    });

    return { ok: true, id: requisicionId };
  } catch (e) {
    if (e instanceof StockInsuficienteEnTransaccion) {
      return { error: `Solo hay ${e.disponible.toLocaleString("es-GT")} disponible(s) de "${e.nombre}" (se pidieron ${e.requerido.toLocaleString("es-GT")}).` };
    }
    return { error: "Error al registrar la requisición" };
  }
}
