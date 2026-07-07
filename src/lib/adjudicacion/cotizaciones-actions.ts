"use server";
import { db } from "@/lib/db";
import { cotizacionesServicio, cotizacionesAnuales, cotizacionesAnualesItems, catalogoCompras } from "@/lib/schema";
import { eq, sql, ilike, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import type { CotizacionAnual } from "./types";

export async function listarCotizacionesServicio() {
  return db.select().from(cotizacionesServicio).orderBy(sql`created_at DESC`);
}

export async function crearCotizacionServicio(data: {
  fecha: string; proveedor_id: number | null; proveedor_nit: string | null;
  proveedor_nombre: string; servicio: string; costo: number; exento_iva: boolean;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };
    if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

    if (!data.proveedor_nombre.trim() || !data.servicio.trim()) return { error: "Proveedor y servicio son obligatorios" };
    if (!(data.costo > 0)) return { error: "Ingresa un costo válido" };

    await db.insert(cotizacionesServicio).values({
      fecha: data.fecha,
      proveedor_id: data.proveedor_id,
      proveedor_nit: data.proveedor_nit,
      proveedor_nombre: data.proveedor_nombre.trim(),
      servicio: data.servicio.trim(),
      costo: data.costo,
      exento_iva: data.exento_iva,
      creado_por: Number(session.user.id),
    });
    return { ok: true };
  } catch {
    return { error: "Error al registrar la cotización" };
  }
}

export async function eliminarCotizacionServicio(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };
    if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

    const [cot] = await db.select({ usado: cotizacionesServicio.usado }).from(cotizacionesServicio)
      .where(eq(cotizacionesServicio.id, id)).limit(1);
    if (!cot) return { error: "No se encontró la cotización" };
    if (cot.usado) return { error: "No se puede eliminar una cotización que ya fue usada" };

    await db.delete(cotizacionesServicio).where(eq(cotizacionesServicio.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al eliminar la cotización" };
  }
}

// ─── Cotizaciones anuales por proveedor (varios insumos con precio pactado) ──

export async function listarCotizacionesAnuales(): Promise<CotizacionAnual[]> {
  const [cabeceras, items] = await Promise.all([
    db.select().from(cotizacionesAnuales).orderBy(sql`created_at DESC`),
    db.select().from(cotizacionesAnualesItems),
  ]);
  return cabeceras.map(c => ({
    ...c,
    items: items.filter(i => i.cotizacion_anual_id === c.id),
  }));
}

export async function crearCotizacionAnual(data: {
  numero: string; anio: number; proveedor_id: number | null; proveedor_nit: string | null;
  proveedor_nombre: string; fecha: string;
}): Promise<{ ok: true; id: number } | { error: string }> {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };
    if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

    const numero = data.numero.trim();
    if (!numero) return { error: "El número de cotización es obligatorio" };
    if (!data.proveedor_nombre.trim()) return { error: "El proveedor es obligatorio" };
    if (!data.fecha) return { error: "La fecha es obligatoria" };

    const [existente] = await db.select({ id: cotizacionesAnuales.id }).from(cotizacionesAnuales)
      .where(eq(cotizacionesAnuales.numero, numero)).limit(1);
    if (existente) return { error: `Ya existe una cotización con el número ${numero}` };

    const [row] = await db.insert(cotizacionesAnuales).values({
      numero, anio: data.anio,
      proveedor_id: data.proveedor_id, proveedor_nit: data.proveedor_nit,
      proveedor_nombre: data.proveedor_nombre.trim(), fecha: data.fecha,
      creado_por: Number(session.user.id),
    }).returning();
    return { ok: true, id: row.id };
  } catch {
    return { error: "Error al registrar la cotización anual" };
  }
}

export async function eliminarCotizacionAnual(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };
    if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

    await db.delete(cotizacionesAnuales).where(eq(cotizacionesAnuales.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al eliminar la cotización anual" };
  }
}

export async function agregarLineaCotizacionAnual(cotizacionAnualId: number, data: {
  codigo_igss: string; precio_unitario: number; exento_iva: boolean;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };
    if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

    const codigo = data.codigo_igss.trim();
    if (!codigo) return { error: "El código de insumo es obligatorio" };
    if (!(data.precio_unitario > 0)) return { error: "Ingresa un precio unitario válido" };

    const [cot] = await db.select({ id: cotizacionesAnuales.id }).from(cotizacionesAnuales)
      .where(eq(cotizacionesAnuales.id, cotizacionAnualId)).limit(1);
    if (!cot) return { error: "No se encontró la cotización anual" };

    const [dup] = await db.select({ id: cotizacionesAnualesItems.id }).from(cotizacionesAnualesItems)
      .where(sql`${cotizacionesAnualesItems.cotizacion_anual_id} = ${cotizacionAnualId} AND ${cotizacionesAnualesItems.codigo_igss} = ${codigo}`)
      .limit(1);
    if (dup) return { error: `El insumo ${codigo} ya tiene un precio en esta cotización` };

    await db.insert(cotizacionesAnualesItems).values({
      cotizacion_anual_id: cotizacionAnualId,
      codigo_igss: codigo,
      precio_unitario: data.precio_unitario,
      exento_iva: data.exento_iva,
    });
    return { ok: true };
  } catch {
    return { error: "Error al agregar la línea de precio" };
  }
}

export async function eliminarLineaCotizacionAnual(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };
    if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

    await db.delete(cotizacionesAnualesItems).where(eq(cotizacionesAnualesItems.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al eliminar la línea de precio" };
  }
}

// Búsqueda de insumos del catálogo de Compras, para armar las líneas de precio
// de una cotización anual (mismo código_igss que usan las solicitudes A-01 SIAF).
export async function buscarInsumoCatalogo(q: string) {
  const session = await auth();
  if (!session) return [];
  if (!q || q.trim().length < 2) return [];
  return db.select({
    codigo_igss:   catalogoCompras.codigo_igss,
    nombre:        catalogoCompras.nombre,
    unidad_medida: catalogoCompras.unidad_medida,
  }).from(catalogoCompras).where(
    or(
      ilike(catalogoCompras.nombre, `%${q}%`),
      sql`${catalogoCompras.codigo_igss} ILIKE ${'%' + q + '%'}`,
    )
  ).limit(8);
}

// Búsqueda de una cotización anual por número exacto (para el flujo de
// Baja Cuantía/Normal en Compras/Adjudicación).
export async function buscarCotizacionAnualPorNumero(numero: string): Promise<CotizacionAnual | null> {
  const session = await auth();
  if (!session) return null;
  const n = numero.trim();
  if (!n) return null;

  const [cabecera] = await db.select().from(cotizacionesAnuales)
    .where(eq(cotizacionesAnuales.numero, n)).limit(1);
  if (!cabecera) return null;

  const items = await db.select().from(cotizacionesAnualesItems)
    .where(eq(cotizacionesAnualesItems.cotizacion_anual_id, cabecera.id));
  return { ...cabecera, items };
}
