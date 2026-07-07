"use server";
import { db } from "@/lib/db";
import {
  siafCompras, siafComprasItems, consolidaciones, actasAdjudicacion,
  ordenesCompra, fondoRotativoPagos, usuarios,
} from "@/lib/schema";
import { inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { renglonLookupMap } from "@/lib/adjudicacion/renglon-utils";

export type HojaDeRuta = {
  siaf: {
    id: number; numero: number; anio: number; fecha: string; estado: string;
    observaciones: string | null;
    creado_por_nombre: string | null; created_at: string | null;
    motivo_rechazo: string | null; rechazado_por_nombre: string | null; rechazado_en: string | null;
    items: { id: number; nombre: string; subproducto: string; cantidad_solicitada: number; renglon: number | null }[];
  };
  consolidacion: {
    id: number; numero: number; anio: number; fecha: string; pre_orden: string | null;
    tipo_compra: string | null; estado: string; destino: string | null;
    motivo_rechazo: string | null; rechazado_por_nombre: string | null; rechazado_en: string | null;
    numero_adjudicacion: string | null;
    proveedor_nombre: string | null; proveedor_nit: string | null; total: number | null;
    numero_a04: number | null; anio_a04: number | null;
    cotizacion_anual_id: number | null; referencia: string | null;
  } | null;
  acta: {
    id: number; no_acta: string; no_formulario: string; estado: string; motivo_rechazo: string | null;
  } | null;
  orden: { numero: number; anio: number; fecha: string; estado: string } | null;
  pago: {
    forma_pago: string | null; estado: string;
    numero_cheque: string | null; fecha_emision_cheque: string | null;
    numero_vale: string | null; fecha_pago: string | null;
  } | null;
};

export async function construirHojaDeRuta(ids: number[]): Promise<HojaDeRuta[]> {
  if (ids.length === 0) return [];

  const siafs = await db.select().from(siafCompras).where(inArray(siafCompras.id, ids));
  const itemsRaw = await db.select({
    id: siafComprasItems.id, solicitud_id: siafComprasItems.solicitud_id,
    codigo_igss: siafComprasItems.codigo_igss,
    nombre: siafComprasItems.nombre, subproducto: siafComprasItems.subproducto,
    cantidad_solicitada: siafComprasItems.cantidad_solicitada,
  }).from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, ids));

  const renglonMap = await renglonLookupMap();
  const items = itemsRaw.map(i => ({
    ...i, renglon: renglonMap.get(`${i.codigo_igss}::${i.subproducto}`) ?? null,
  }));

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
  const pagos = consolIds.length > 0
    ? await db.select().from(fondoRotativoPagos).where(inArray(fondoRotativoPagos.consolidacion_id, consolIds))
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
    const pago = con ? pagos.find(p => p.consolidacion_id === con.id) ?? null : null;

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
        cotizacion_anual_id: con.cotizacion_anual_id, referencia: con.referencia,
      } : null,
      acta: acta ? {
        id: acta.id, no_acta: acta.no_acta, no_formulario: acta.no_formulario,
        estado: acta.estado, motivo_rechazo: acta.motivo_rechazo,
      } : null,
      orden: orden ? { numero: orden.numero, anio: orden.anio, fecha: orden.fecha, estado: orden.estado } : null,
      pago: pago ? {
        forma_pago: pago.forma_pago, estado: pago.estado,
        numero_cheque: pago.numero_cheque, fecha_emision_cheque: pago.fecha_emision_cheque,
        numero_vale: pago.numero_vale, fecha_pago: pago.fecha_pago,
      } : null,
    };
  }).sort((a, b) => b.siaf.id - a.siaf.id);
}

// Todo el historial, sin excepción — un SIAF aparece aquí desde que se crea
// (incluso en Borrador) y nunca se quita de la lista, sin importar en qué
// estado o etapa termine; solo cambia su resumen de estado. La búsqueda sobre
// esta lista se hace en el cliente, para que la pantalla sirva tanto para
// "ver todo lo que hemos hecho" como para buscar un caso puntual.
export async function listarHojaDeRuta(): Promise<HojaDeRuta[]> {
  const session = await auth();
  if (!session) return [];

  const rows = await db.select({ id: siafCompras.id }).from(siafCompras).orderBy(sql`id DESC`);
  return construirHojaDeRuta(rows.map(r => r.id));
}

