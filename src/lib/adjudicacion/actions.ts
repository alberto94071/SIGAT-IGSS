"use server";
import { db } from "@/lib/db";
import {
  consolidaciones, consolidacionPrecios, siafCompras, siafComprasItems,
  ordenesCompra, proveedores, oferentes, cotizacionesServicio, usuarios,
} from "@/lib/schema";
import { eq, sql, inArray, ilike, or, and, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import type { Consolidacion, InsumoPrecio, Oferente } from "./types";
import { renglonLookupMap } from "./renglon-utils";

// ─── Lectura ──────────────────────────────────────────────────────────────────

export async function getConsolidacionesConDetalles(): Promise<Consolidacion[]> {
  const cons = await db.select().from(consolidaciones)
    .orderBy(sql`anio DESC, numero DESC`);

  const siaf = await db.select({
    id:               siafCompras.id,
    numero:           siafCompras.numero,
    anio:             siafCompras.anio,
    fecha:            siafCompras.fecha,
    estado:           siafCompras.estado,
    consolidacion_id: siafCompras.consolidacion_id,
  }).from(siafCompras).where(isNotNull(siafCompras.consolidacion_id));

  const siafIds = siaf.map(s => s.id);
  let items: { solicitud_id: number; codigo_igss: string | null; subproducto: string;
    nombre: string; unidad_medida: string | null; cantidad_solicitada: number }[] = [];
  if (siafIds.length > 0) {
    items = await db.select({
      solicitud_id:        siafComprasItems.solicitud_id,
      codigo_igss:         siafComprasItems.codigo_igss,
      subproducto:         siafComprasItems.subproducto,
      nombre:              siafComprasItems.nombre,
      unidad_medida:       siafComprasItems.unidad_medida,
      cantidad_solicitada: siafComprasItems.cantidad_solicitada,
    }).from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds));
  }

  const precios = cons.length > 0
    ? await db.select().from(consolidacionPrecios)
        .where(inArray(consolidacionPrecios.consolidacion_id, cons.map(c => c.id)))
    : [];

  const ofertas = cons.length > 0
    ? await db.select().from(oferentes)
        .where(inArray(oferentes.consolidacion_id, cons.map(c => c.id)))
        .orderBy(oferentes.orden, oferentes.id)
    : [];

  const rechazadoPorIds = [...new Set(cons.map(c => c.rechazado_por).filter((v): v is number => v != null))];
  const usuariosMap = new Map<number, string>();
  if (rechazadoPorIds.length > 0) {
    const us = await db.select({ id: usuarios.id, nombre: usuarios.nombre })
      .from(usuarios).where(inArray(usuarios.id, rechazadoPorIds));
    for (const u of us) usuariosMap.set(u.id, u.nombre);
  }

  const renglonMap = await renglonLookupMap();

  return cons.map(c => {
    const cSiaf = siaf.filter(s => s.consolidacion_id === c.id);
    const cSiafIds = new Set(cSiaf.map(s => s.id));
    const cItems = items.filter(i => cSiafIds.has(i.solicitud_id));
    const total_cantidad = cItems.reduce((sum, i) => sum + (i.cantidad_solicitada ?? 0), 0);

    // Agrupar por codigo_igss + subproducto (mismo patrón que el historial de SiafClient)
    const grupos = new Map<string, InsumoPrecio>();
    for (const item of cItems) {
      const key = `${item.codigo_igss}::${item.subproducto}`;
      const existente = grupos.get(key);
      if (existente) {
        existente.cantidad += item.cantidad_solicitada;
      } else {
        grupos.set(key, {
          codigo_igss: item.codigo_igss, subproducto: item.subproducto,
          nombre: item.nombre, unidad_medida: item.unidad_medida,
          cantidad: item.cantidad_solicitada, precio_unitario: null,
          renglon: renglonMap.get(key) ?? null,
        });
      }
    }
    const cPrecios = precios.filter(p => p.consolidacion_id === c.id);
    for (const p of cPrecios) {
      const key = `${p.codigo_igss}::${p.subproducto}`;
      const grupo = grupos.get(key);
      if (grupo) grupo.precio_unitario = p.precio_unitario;
    }

    const cOferentes: Oferente[] = ofertas.filter(o => o.consolidacion_id === c.id);

    return {
      ...c,
      rechazado_por_nombre: c.rechazado_por != null ? usuariosMap.get(c.rechazado_por) ?? null : null,
      siaf: cSiaf, total_cantidad, precios: Array.from(grupos.values()),
      oferentes: cOferentes,
    };
  });
}

export async function getOrdenes() {
  return db.select().from(ordenesCompra).orderBy(sql`anio DESC, numero DESC`);
}

export async function buscarProveedoresAuto(q: string) {
  const session = await auth();
  if (!session) return [];
  if (!q || q.trim().length < 2) return [];
  return db.select({
    id:        proveedores.id,
    nit:       proveedores.nit,
    nombre:    proveedores.nombre,
    telefono:  proveedores.telefono,
    direccion: proveedores.direccion,
  }).from(proveedores).where(
    and(
      eq(proveedores.activo, true),
      or(
        ilike(proveedores.nombre, `%${q}%`),
        sql`${proveedores.nit} ILIKE ${'%' + q + '%'}`,
      )
    )
  ).limit(8);
}

// ─── Anular Consolidación ─────────────────────────────────────────────────────

export async function anularConsolidacion(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };
    if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

    await db.update(siafCompras)
      .set({ estado: "Borrador", consolidacion_id: null })
      .where(eq(siafCompras.consolidacion_id, id));
    // Libera cualquier cotización de servicio que se hubiera reservado para esta consolidación
    await db.update(cotizacionesServicio)
      .set({ usado: false, usado_en_consolidacion_id: null })
      .where(eq(cotizacionesServicio.usado_en_consolidacion_id, id));
    await db.delete(consolidaciones).where(eq(consolidaciones.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al anular la consolidación" };
  }
}

// ─── Pantallas destino (SIAF-04) ──────────────────────────────────────────────
// Nota: destino="presupuesto" ya no se genera aquí — esas consolidaciones pasan
// directo a /compras/ordenes (ver ordenes-actions.ts) al aprobarse el Acta o al
// adjudicar directo (Contrato Abierto). Esta bandeja solo queda para Fondo Rotativo.

export async function getPendientesPorDestino(destino: "fondo_rotativo" | "presupuesto"): Promise<Consolidacion[]> {
  const estadoBuscar = destino === "fondo_rotativo" ? "Enviado a Fondo Rotativo" : "Enviado a Presupuesto";

  const cons = await db.select().from(consolidaciones)
    .where(and(eq(consolidaciones.destino, destino), eq(consolidaciones.estado, estadoBuscar)))
    .orderBy(sql`created_at DESC`);

  if (cons.length === 0) return [];

  const siaf = await db.select({
    id: siafCompras.id, numero: siafCompras.numero, anio: siafCompras.anio,
    fecha: siafCompras.fecha, estado: siafCompras.estado,
    consolidacion_id: siafCompras.consolidacion_id,
  }).from(siafCompras).where(inArray(siafCompras.consolidacion_id, cons.map(c => c.id)));

  const siafIds = siaf.map(s => s.id);
  const items = siafIds.length > 0
    ? await db.select({
        solicitud_id: siafComprasItems.solicitud_id,
        codigo_igss:  siafComprasItems.codigo_igss,
        subproducto:  siafComprasItems.subproducto,
        nombre:       siafComprasItems.nombre,
        unidad_medida: siafComprasItems.unidad_medida,
        cantidad_solicitada: siafComprasItems.cantidad_solicitada,
      }).from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds))
    : [];

  const precios = await db.select().from(consolidacionPrecios)
    .where(inArray(consolidacionPrecios.consolidacion_id, cons.map(c => c.id)));

  const renglonMap = await renglonLookupMap();

  return cons.map(c => {
    const cSiaf = siaf.filter(s => s.consolidacion_id === c.id);
    const cSiafIds = new Set(cSiaf.map(s => s.id));
    const cItems = items.filter(i => cSiafIds.has(i.solicitud_id));
    const total_cantidad = cItems.reduce((sum, i) => sum + i.cantidad_solicitada, 0);

    const grupos = new Map<string, InsumoPrecio>();
    for (const item of cItems) {
      const key = `${item.codigo_igss}::${item.subproducto}`;
      const ex = grupos.get(key);
      if (ex) { ex.cantidad += item.cantidad_solicitada; }
      else {
        grupos.set(key, {
          codigo_igss: item.codigo_igss, subproducto: item.subproducto,
          nombre: item.nombre, unidad_medida: item.unidad_medida,
          cantidad: item.cantidad_solicitada, precio_unitario: null,
          renglon: renglonMap.get(key) ?? null,
        });
      }
    }
    for (const p of precios.filter(p => p.consolidacion_id === c.id)) {
      const g = grupos.get(`${p.codigo_igss}::${p.subproducto}`);
      if (g) g.precio_unitario = p.precio_unitario;
    }

    return {
      ...c, rechazado_por_nombre: null,
      siaf: cSiaf, total_cantidad, precios: Array.from(grupos.values()),
      oferentes: [] as Oferente[],
    };
  });
}

