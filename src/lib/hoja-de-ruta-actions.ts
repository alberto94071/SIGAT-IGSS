"use server";
import { db } from "@/lib/db";
import {
  siafCompras, siafComprasItems, consolidaciones, actasAdjudicacion,
  ordenesCompra, usuarios,
} from "@/lib/schema";
import { inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export type HojaDeRuta = {
  siaf: {
    id: number; numero: number; anio: number; fecha: string; estado: string;
    observaciones: string | null;
    creado_por_nombre: string | null; created_at: string | null;
    motivo_rechazo: string | null; rechazado_por_nombre: string | null; rechazado_en: string | null;
    items: { id: number; nombre: string; subproducto: string; cantidad_solicitada: number }[];
  };
  consolidacion: {
    id: number; numero: number; anio: number; fecha: string; pre_orden: string | null;
    tipo_compra: string | null; estado: string; destino: string | null;
    motivo_rechazo: string | null; rechazado_por_nombre: string | null; rechazado_en: string | null;
    numero_adjudicacion: string | null;
    proveedor_nombre: string | null; proveedor_nit: string | null; total: number | null;
    numero_a04: number | null; anio_a04: number | null;
  } | null;
  acta: {
    no_acta: string; no_formulario: string; estado: string; motivo_rechazo: string | null;
  } | null;
  orden: { numero: number; anio: number; fecha: string; estado: string } | null;
};

async function construirHojaDeRuta(ids: number[]): Promise<HojaDeRuta[]> {
  if (ids.length === 0) return [];

  const siafs = await db.select().from(siafCompras).where(inArray(siafCompras.id, ids));
  const items = await db.select({
    id: siafComprasItems.id, solicitud_id: siafComprasItems.solicitud_id,
    nombre: siafComprasItems.nombre, subproducto: siafComprasItems.subproducto,
    cantidad_solicitada: siafComprasItems.cantidad_solicitada,
  }).from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, ids));

  const consolIds = [...new Set(siafs.map(s => s.consolidacion_id).filter((v): v is number => v != null))];
  const consols = consolIds.length > 0
    ? await db.select().from(consolidaciones).where(inArray(consolidaciones.id, consolIds))
    : [];
  const actas = consolIds.length > 0
    ? await db.select().from(actasAdjudicacion).where(inArray(actasAdjudicacion.consolidacion_id, consolIds))
    : [];
  const ordenes = consolIds.length > 0
    ? await db.select().from(ordenesCompra).where(inArray(ordenesCompra.consolidacion_id, consolIds))
    : [];

  const usuarioIds = [...new Set([
    ...siafs.map(s => s.creado_por), ...siafs.map(s => s.rechazado_por),
    ...consols.map(c => c.rechazado_por),
  ].filter((v): v is number => v != null))];
  const usuariosList = usuarioIds.length > 0
    ? await db.select({ id: usuarios.id, nombre: usuarios.nombre }).from(usuarios).where(inArray(usuarios.id, usuarioIds))
    : [];
  const usuariosMap = new Map(usuariosList.map(u => [u.id, u.nombre]));

  return siafs.map((s): HojaDeRuta => {
    const con = s.consolidacion_id != null ? consols.find(c => c.id === s.consolidacion_id) ?? null : null;
    const acta = con ? actas.find(a => a.consolidacion_id === con.id) ?? null : null;
    const orden = con ? ordenes.find(o => o.consolidacion_id === con.id) ?? null : null;

    return {
      siaf: {
        id: s.id, numero: s.numero, anio: s.anio, fecha: s.fecha, estado: s.estado,
        observaciones: s.observaciones,
        creado_por_nombre: s.creado_por != null ? usuariosMap.get(s.creado_por) ?? null : null,
        created_at: s.created_at,
        motivo_rechazo: s.motivo_rechazo,
        rechazado_por_nombre: s.rechazado_por != null ? usuariosMap.get(s.rechazado_por) ?? null : null,
        rechazado_en: s.rechazado_en,
        items: items.filter(i => i.solicitud_id === s.id),
      },
      consolidacion: con ? {
        id: con.id, numero: con.numero, anio: con.anio, fecha: con.fecha, pre_orden: con.pre_orden,
        tipo_compra: con.tipo_compra, estado: con.estado, destino: con.destino,
        motivo_rechazo: con.motivo_rechazo,
        rechazado_por_nombre: con.rechazado_por != null ? usuariosMap.get(con.rechazado_por) ?? null : null,
        rechazado_en: con.rechazado_en,
        numero_adjudicacion: con.numero_adjudicacion,
        proveedor_nombre: con.proveedor_nombre, proveedor_nit: con.proveedor_nit, total: con.total,
        numero_a04: con.numero_a04, anio_a04: con.anio_a04,
      } : null,
      acta: acta ? {
        no_acta: acta.no_acta, no_formulario: acta.no_formulario,
        estado: acta.estado, motivo_rechazo: acta.motivo_rechazo,
      } : null,
      orden: orden ? { numero: orden.numero, anio: orden.anio, fecha: orden.fecha, estado: orden.estado } : null,
    };
  }).sort((a, b) => b.siaf.id - a.siaf.id);
}

// Todo el historial (más reciente primero) — la búsqueda sobre esta lista se
// hace en el cliente, para que la pantalla sirva tanto para "ver todo lo que
// hemos hecho" como para buscar un caso puntual, sin dos pantallas separadas.
export async function listarHojaDeRuta(): Promise<HojaDeRuta[]> {
  const session = await auth();
  if (!session) return [];

  const rows = await db.select({ id: siafCompras.id }).from(siafCompras)
    .orderBy(sql`id DESC`).limit(500);
  return construirHojaDeRuta(rows.map(r => r.id));
}
