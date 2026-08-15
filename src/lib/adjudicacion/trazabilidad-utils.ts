import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, consolidaciones } from "@/lib/schema";
import { inArray } from "drizzle-orm";
import { renglonLookupMap } from "./renglon-utils";

// Detalle completo de trazabilidad de una consolidación, para pintar en el
// panel abatible de cualquier pantalla posterior (Compromiso, Devengado,
// DAB-60, Fondo Rotativo/Pagos, Bancos, Caja Chica, etc.) — todas esas
// pantallas ya tienen a mano un consolidacion_id (vía ordenes_compra o
// fondo_rotativo_pagos) pero hoy no lo cruzan hacia atrás con el/los SIAF de
// origen. A diferencia de gruposRenglonDeConsolidacion (que agrega todo el
// monto/cantidad de un mismo codigo_igss::subproducto::nombre en un solo
// número), acá se conserva el desglose por SIAF de origen en "origenes" —
// varios SIAF distintos pueden aportar cantidad al mismo insumo dentro de
// una misma consolidación.
export type OrigenSiaf = { siaf_id: number; siaf_numero: number; siaf_anio: number; cantidad: number };

export type ItemTrazabilidad = {
  codigo_igss: string | null;
  codigo_ppr: string | null;
  nombre: string;
  subproducto: string;
  renglon: number | null;
  unidad_medida: string | null;
  cantidad_total: number;
  precio_unitario: number | null;
  monto_total: number;
  origenes: OrigenSiaf[];
};

export type TrazabilidadConsolidacion = {
  consolidacion_id: number;
  consolidacion_numero: number | null;
  consolidacion_anio: number | null;
  pre_orden: string | null;
  numero_adjudicacion: string | null;
  siaf_correlativos: string[];
  items: ItemTrazabilidad[];
};

// Batch: trae la trazabilidad de varias consolidaciones en un solo query por
// tabla (mismo criterio anti-N+1 que gruposRenglonDeConsolidacion), para usar
// en pantallas que listan muchas filas a la vez.
export async function trazabilidadPorConsolidaciones(consolidacionIds: number[]): Promise<Map<number, TrazabilidadConsolidacion>> {
  const out = new Map<number, TrazabilidadConsolidacion>();
  const ids = [...new Set(consolidacionIds)];
  if (ids.length === 0) return out;

  const [cons, siafs, renglonMap] = await Promise.all([
    db.select({
      id: consolidaciones.id, numero: consolidaciones.numero, anio: consolidaciones.anio,
      pre_orden: consolidaciones.pre_orden, numero_adjudicacion: consolidaciones.numero_adjudicacion,
    }).from(consolidaciones).where(inArray(consolidaciones.id, ids)),
    db.select({ id: siafCompras.id, numero: siafCompras.numero, anio: siafCompras.anio, consolidacion_id: siafCompras.consolidacion_id })
      .from(siafCompras).where(inArray(siafCompras.consolidacion_id, ids)),
    renglonLookupMap(),
  ]);

  const siafIds = siafs.map(s => s.id);
  const items = siafIds.length > 0
    ? await db.select({
        solicitud_id: siafComprasItems.solicitud_id, codigo_igss: siafComprasItems.codigo_igss,
        codigo_ppr: siafComprasItems.codigo_ppr, nombre: siafComprasItems.nombre,
        subproducto: siafComprasItems.subproducto, unidad_medida: siafComprasItems.unidad_medida,
        cantidad_solicitada: siafComprasItems.cantidad_solicitada, precio_unitario: siafComprasItems.precio_unitario,
      }).from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds))
    : [];

  const siafPorId = new Map(siafs.map(s => [s.id, s]));

  for (const con of cons) {
    const siafsDeCon = siafs.filter(s => s.consolidacion_id === con.id);
    const itemsDeCon = items.filter(i => siafPorId.get(i.solicitud_id)?.consolidacion_id === con.id);

    const grupos = new Map<string, ItemTrazabilidad>();
    for (const item of itemsDeCon) {
      const key = `${item.codigo_igss}::${item.subproducto}::${item.nombre}`;
      const siaf = siafPorId.get(item.solicitud_id)!;
      const monto = item.cantidad_solicitada * (item.precio_unitario ?? 0);
      let grupo = grupos.get(key);
      if (!grupo) {
        grupo = {
          codigo_igss: item.codigo_igss, codigo_ppr: item.codigo_ppr, nombre: item.nombre,
          subproducto: item.subproducto,
          renglon: item.codigo_igss != null ? renglonMap.get(key) ?? null : null,
          unidad_medida: item.unidad_medida,
          cantidad_total: 0, precio_unitario: item.precio_unitario, monto_total: 0, origenes: [],
        };
        grupos.set(key, grupo);
      }
      grupo.cantidad_total += item.cantidad_solicitada;
      grupo.monto_total += monto;
      if (item.precio_unitario != null) grupo.precio_unitario = item.precio_unitario;

      const origen = grupo.origenes.find(o => o.siaf_id === siaf.id);
      if (origen) origen.cantidad += item.cantidad_solicitada;
      else grupo.origenes.push({ siaf_id: siaf.id, siaf_numero: siaf.numero, siaf_anio: siaf.anio, cantidad: item.cantidad_solicitada });
    }

    out.set(con.id, {
      consolidacion_id: con.id, consolidacion_numero: con.numero, consolidacion_anio: con.anio,
      pre_orden: con.pre_orden, numero_adjudicacion: con.numero_adjudicacion,
      siaf_correlativos: [...new Set(siafsDeCon.map(s => `${s.numero}/${s.anio}`))],
      items: Array.from(grupos.values()),
    });
  }

  return out;
}

export async function trazabilidadPorConsolidacion(consolidacionId: number): Promise<TrazabilidadConsolidacion | null> {
  const map = await trazabilidadPorConsolidaciones([consolidacionId]);
  return map.get(consolidacionId) ?? null;
}
