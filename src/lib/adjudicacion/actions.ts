"use server";
import { db } from "@/lib/db";
import {
  consolidaciones, consolidacionPrecios, siafCompras, siafComprasItems,
  ordenesCompra, proveedores,
} from "@/lib/schema";
import { eq, sql, inArray, ilike, or, and, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import type { Consolidacion, InsumoPrecio, TipoCompra } from "./types";

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
  let items: { solicitud_id: number; codigo_igss: number | null; subproducto: string;
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
        });
      }
    }
    const cPrecios = precios.filter(p => p.consolidacion_id === c.id);
    for (const p of cPrecios) {
      const key = `${p.codigo_igss}::${p.subproducto}`;
      const grupo = grupos.get(key);
      if (grupo) grupo.precio_unitario = p.precio_unitario;
    }

    return { ...c, siaf: cSiaf, total_cantidad, precios: Array.from(grupos.values()) };
  });
}

export async function getOrdenes() {
  return db.select().from(ordenesCompra).orderBy(sql`anio DESC, numero DESC`);
}

export async function buscarProveedoresAuto(q: string) {
  if (!q || q.trim().length < 2) return [];
  return db.select({
    id:       proveedores.id,
    nit:      proveedores.nit,
    nombre:   proveedores.nombre,
    telefono: proveedores.telefono,
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

// ─── Adjudicación (Junta Adjudicadora) ───────────────────────────────────────

export async function adjudicar(id: number, data: {
  tipo_compra:      TipoCompra;
  proveedor_id:     number | null;
  proveedor_nit:    string;
  proveedor_nombre: string;
  numero_adjudicacion: string;
  nog?:          string;
  fecha_evento?: string;
}) {
  try {
    const numAdj = data.numero_adjudicacion.trim();
    if (!/^\d+$/.test(numAdj)) {
      return { error: "El Número de Adjudicación solo puede contener dígitos" };
    }
    if (!data.proveedor_nombre.trim()) {
      return { error: "Selecciona un proveedor" };
    }
    if (data.tipo_compra === "Compra Directa") {
      if (!data.nog?.trim()) return { error: "El NOG es obligatorio para Compra Directa" };
      if (!data.fecha_evento) return { error: "La fecha de finalización del evento es obligatoria" };
    }

    const [existente] = await db.select({ id: consolidaciones.id })
      .from(consolidaciones).where(eq(consolidaciones.numero_adjudicacion, numAdj)).limit(1);
    if (existente) return { error: `Ya existe una consolidación con el Número de Adjudicación ${numAdj}` };

    await db.update(consolidaciones).set({
      tipo_compra:         data.tipo_compra,
      estado:               "Adjudicado",
      proveedor_id:         data.proveedor_id,
      proveedor_nit:        data.proveedor_nit,
      proveedor_nombre:     data.proveedor_nombre,
      numero_adjudicacion:  numAdj,
      nog:                  data.tipo_compra === "Compra Directa" ? data.nog!.trim() : null,
      fecha_evento:         data.tipo_compra === "Compra Directa" ? data.fecha_evento! : null,
    }).where(eq(consolidaciones.id, id));

    await db.update(siafCompras)
      .set({ estado: "Adjudicado" })
      .where(eq(siafCompras.consolidacion_id, id));

    return { ok: true };
  } catch {
    return { error: "Error al registrar la adjudicación" };
  }
}

// ─── Anular Consolidación ─────────────────────────────────────────────────────

export async function anularConsolidacion(id: number) {
  try {
    await db.update(siafCompras)
      .set({ estado: "Borrador", consolidacion_id: null })
      .where(eq(siafCompras.consolidacion_id, id));
    await db.delete(consolidaciones).where(eq(consolidaciones.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al anular la consolidación" };
  }
}
