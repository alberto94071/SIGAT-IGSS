import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoCompras, baseDatosCentral } from "@/lib/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";

// Mapa completo codigo_igss::subproducto -> renglón, para anotar listas de
// ítems ya cargadas sin hacer una consulta por ítem (mismo cruce que usa la
// automatización de pre-compromiso, pero en un solo query).
export async function renglonLookupMap(): Promise<Map<string, number | null>> {
  const rows = await db.select({
    codigo_igss: catalogoCompras.codigo_igss, subproducto: catalogoCompras.subproducto,
    renglon: catalogoCompras.renglon,
  }).from(catalogoCompras);
  const map = new Map<string, number | null>();
  for (const r of rows) map.set(`${r.codigo_igss}::${r.subproducto}`, r.renglon);
  return map;
}

// Mapa codigo_igss -> unidad de medida vigente en Base de Datos Central.
// catalogo_compras (renglón/subproducto/precio) ya no tiene columna de
// unidad de medida — ese dato vive en base_datos_central (ficha del insumo),
// identificado por codigo_igss. Se usa como respaldo cuando el snapshot
// guardado en siaf_compras_items al crear la solicitud quedó vacío (insumo
// que no tenía unidad de medida cargada en ese momento) y luego se completó
// en Base de Datos Central.
export async function unidadMedidaLookupMap(): Promise<Map<string, string | null>> {
  const rows = await db.select({
    codigo_igss: baseDatosCentral.codigo_igss, unidad_medida: baseDatosCentral.unidad_medida,
  }).from(baseDatosCentral).where(isNotNull(baseDatosCentral.codigo_igss));
  const map = new Map<string, string | null>();
  for (const r of rows) if (r.codigo_igss) map.set(r.codigo_igss, r.unidad_medida);
  return map;
}

export type GrupoRenglon = {
  renglon: number | null; codigo_igss: string | null; codigo_ppr: string | null; subproducto: string;
  nombre: string; cantidad: number; total: number;
};

// Agrupa los insumos de los SIAF consolidados de una consolidación por
// renglón + subproducto (mismo cruce con el catálogo que usa la automatización
// de pre-compromiso al aprobar un SIAF).
export async function gruposRenglonDeConsolidacion(consolidacionId: number): Promise<GrupoRenglon[]> {
  const siafIds = (await db.select({ id: siafCompras.id }).from(siafCompras)
    .where(eq(siafCompras.consolidacion_id, consolidacionId))).map(s => s.id);
  if (siafIds.length === 0) return [];

  const items = await db.select({
    codigo_igss:         siafComprasItems.codigo_igss,
    codigo_ppr:          siafComprasItems.codigo_ppr,
    subproducto:         siafComprasItems.subproducto,
    nombre:              siafComprasItems.nombre,
    cantidad_solicitada: siafComprasItems.cantidad_solicitada,
    precio_unitario:     siafComprasItems.precio_unitario,
  }).from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds));

  const grupos = new Map<string, GrupoRenglon>();
  for (const item of items) {
    let renglon: number | null = null;
    if (item.codigo_igss != null) {
      const [cat] = await db.select({ renglon: catalogoCompras.renglon }).from(catalogoCompras)
        .where(and(eq(catalogoCompras.codigo_igss, item.codigo_igss), eq(catalogoCompras.subproducto, item.subproducto)))
        .limit(1);
      renglon = cat?.renglon ?? null;
    }
    const key = `${item.codigo_igss}::${item.subproducto}`;
    const itemTotal = item.cantidad_solicitada * (item.precio_unitario ?? 0);
    const existente = grupos.get(key);
    if (existente) {
      existente.cantidad += item.cantidad_solicitada;
      existente.total += itemTotal;
    }
    else grupos.set(key, {
      renglon, codigo_igss: item.codigo_igss, codigo_ppr: item.codigo_ppr,
      subproducto: item.subproducto, nombre: item.nombre, cantidad: item.cantidad_solicitada,
      total: itemTotal,
    });
  }
  return Array.from(grupos.values());
}
