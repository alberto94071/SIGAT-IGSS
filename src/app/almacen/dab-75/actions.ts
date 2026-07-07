"use server";
import { db } from "@/lib/db";
import { requisicionesBodega, requisicionBodegaItems } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

export type ItemRequisicion = { codigo: string; nombre: string; cantidad_solicitada: number };

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
  const items = data.items.filter(i => i.codigo.trim() || i.nombre.trim());
  if (items.length === 0) return { error: "Debe agregar al menos un insumo" };
  if (items.length > 14) return { error: "Máximo 14 insumos por requisición (espacio de la hoja)" };
  for (const it of items) {
    if (!it.codigo.trim()) return { error: "Todos los insumos deben tener Código" };
    if (!it.nombre.trim()) return { error: "Todos los insumos deben tener Nombre" };
    if (!(it.cantidad_solicitada > 0)) return { error: "La cantidad solicitada debe ser mayor a cero" };
  }

  try {
    const [row] = await db.insert(requisicionesBodega).values({
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

    await db.insert(requisicionBodegaItems).values(
      items.map((it, i) => ({
        requisicion_id: row.id,
        codigo: it.codigo.trim(),
        nombre: it.nombre.trim(),
        cantidad_solicitada: it.cantidad_solicitada,
        orden: i,
      }))
    );

    return { ok: true, id: row.id };
  } catch {
    return { error: "Error al registrar la requisición" };
  }
}
