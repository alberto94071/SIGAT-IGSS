"use server";
import { db } from "@/lib/db";
import {
  siafCompras, siafComprasItems, consolidaciones, actasAdjudicacion,
  ordenesCompra, fondoRotativoPagos, usuarios, friFondoRotativo,
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
    items: { id: number; codigo_igss: string | null; codigo_ppr: string | null; nombre: string; subproducto: string; cantidad_solicitada: number; renglon: number | null; precio_unitario: number | null }[];
  };
  consolidacion: {
    id: number; numero: number; anio: number; fecha: string; pre_orden: string | null;
    tipo_compra: string | null; estado: string; destino: string | null;
    motivo_rechazo: string | null; rechazado_por_nombre: string | null; rechazado_en: string | null;
    numero_adjudicacion: string | null;
    proveedor_nombre: string | null; proveedor_nit: string | null; total: number | null;
    numero_a04: number | null; anio_a04: number | null;
    cotizacion_anual_id: number | null; referencia: string | null;
    historial_devoluciones: string | null;
  } | null;
  acta: {
    id: number; no_acta: string; no_formulario: string; estado: string; motivo_rechazo: string | null;
  } | null;
  orden: {
    id: number; numero: number; anio: number; fecha: string; estado: string;
    no_compromiso: string | null; dab60_generado_en: string | null;
    no_devengado: string | null; fecha_ingreso_producto: string | null;
    no_factura: string | null; serie_factura: string | null; fecha_emision: string | null;
    lote: string | null; fecha_vencimiento: string | null;
    marca: string | null; modelo: string | null; serie: string | null;
    historial_devoluciones: string | null;
  } | null;
  pago: {
    id: number;
    forma_pago: string | null; estado: string;
    numero_cheque: string | null; fecha_emision_cheque: string | null;
    numero_vale: string | null; fecha_pago: string | null; vale_id: number | null;
    fri_id: number | null; fri_numero: number | null; fri_anio: number | null;
    dab60_no_recibo_almacen: string | null; dab60_serie_recibo_almacen: string | null;
    dab60_encargado_almacen: string | null; dab60_fecha_ingreso_producto: string | null;
    dab60_lote: string | null; dab60_fecha_vencimiento: string | null;
    dab60_marca: string | null; dab60_modelo: string | null; dab60_serie: string | null;
    dab60_generado_en: string | null;
  } | null;
};

export async function construirHojaDeRuta(ids: number[]): Promise<HojaDeRuta[]> {
  if (ids.length === 0) return [];

  const siafs = await db.select().from(siafCompras).where(inArray(siafCompras.id, ids));
  const itemsRaw = await db.select({
    id: siafComprasItems.id, solicitud_id: siafComprasItems.solicitud_id,
    codigo_igss: siafComprasItems.codigo_igss, codigo_ppr: siafComprasItems.codigo_ppr,
    nombre: siafComprasItems.nombre, subproducto: siafComprasItems.subproducto,
    cantidad_solicitada: siafComprasItems.cantidad_solicitada,
    precio_unitario: siafComprasItems.precio_unitario,
  }).from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, ids));

  const renglonMap = await renglonLookupMap();
  const items = itemsRaw.map(i => ({
    ...i, renglon: renglonMap.get(`${i.codigo_igss}::${i.subproducto}::${i.nombre}`) ?? null,
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
  const friIds = [...new Set(pagos.map(p => p.fri_id).filter((v): v is number => v != null))];
  const fris = friIds.length > 0
    ? await db.select().from(friFondoRotativo).where(inArray(friFondoRotativo.id, friIds))
    : [];
  const frisMap = new Map(fris.map(f => [f.id, f]));

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
    // Puede haber más de una orden para la misma consolidación si una se
    // devolvió hasta Adjudicación (ver regresarOrdenAAdjudicacion) y se
    // volvió a generar otra — se prioriza la vigente (no Anulada); si todas
    // están Anuladas, se muestra la más reciente.
    const ordenesDeCon = con ? ordenes.filter(o => o.consolidacion_id === con.id) : [];
    const orden = ordenesDeCon.find(o => o.estado !== "Anulada")
      ?? [...ordenesDeCon].sort((a, b) => b.id - a.id)[0]
      ?? null;
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
        historial_devoluciones: con.historial_devoluciones,
      } : null,
      acta: acta ? {
        id: acta.id, no_acta: acta.no_acta, no_formulario: acta.no_formulario,
        estado: acta.estado, motivo_rechazo: acta.motivo_rechazo,
      } : null,
      orden: orden ? {
        id: orden.id, numero: orden.numero, anio: orden.anio, fecha: orden.fecha, estado: orden.estado,
        no_compromiso: orden.no_compromiso, dab60_generado_en: orden.dab60_generado_en,
        no_devengado: orden.no_devengado, fecha_ingreso_producto: orden.fecha_ingreso_producto,
        no_factura: orden.no_factura, serie_factura: orden.serie_factura, fecha_emision: orden.fecha_emision,
        lote: orden.lote, fecha_vencimiento: orden.fecha_vencimiento,
        marca: orden.marca, modelo: orden.modelo, serie: orden.serie,
        historial_devoluciones: orden.historial_devoluciones,
      } : null,
      pago: pago ? {
        id: pago.id,
        forma_pago: pago.forma_pago, estado: pago.estado,
        numero_cheque: pago.numero_cheque, fecha_emision_cheque: pago.fecha_emision_cheque,
        numero_vale: pago.numero_vale, fecha_pago: pago.fecha_pago, vale_id: pago.vale_id,
        fri_id: pago.fri_id,
        fri_numero: pago.fri_id != null ? frisMap.get(pago.fri_id)?.numero ?? null : null,
        fri_anio: pago.fri_id != null ? frisMap.get(pago.fri_id)?.anio ?? null : null,
        dab60_no_recibo_almacen: pago.dab60_no_recibo_almacen, dab60_serie_recibo_almacen: pago.dab60_serie_recibo_almacen,
        dab60_encargado_almacen: pago.dab60_encargado_almacen, dab60_fecha_ingreso_producto: pago.dab60_fecha_ingreso_producto,
        dab60_lote: pago.dab60_lote, dab60_fecha_vencimiento: pago.dab60_fecha_vencimiento,
        dab60_marca: pago.dab60_marca, dab60_modelo: pago.dab60_modelo, dab60_serie: pago.dab60_serie,
        dab60_generado_en: pago.dab60_generado_en,
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

