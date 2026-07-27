import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoCompras, baseDatosCentral } from "@/lib/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";

// ─── PPR (presentación) por código base ──────────────────────────────────────
// Un mismo código IGSS base ("1941") puede tener varias presentaciones/PPR
// registradas en Base de Datos Central (galón, litro, unidad...), cada una con
// su propio codigo_ppr. El código IGSS completo es código + PPR.
export type PprOpcion = {
  codigo: string; codigo_igss: string | null; codigo_ppr: number | null;
  nombre: string; caracteristicas: string | null; presentacion: string | null; unidad_medida: string | null;
};

// Trae, para cada código base de la lista, todas sus presentaciones/PPR
// registradas en Base de Datos Central — para poblar el selector de PPR al
// generar la Orden de Compra o el SIAF-04.
export async function getPprsPorCodigos(codigos: (string | null)[]): Promise<Record<string, PprOpcion[]>> {
  const limpios = [...new Set(codigos.filter((c): c is string => !!c))];
  if (limpios.length === 0) return {};
  const rows = await db.select({
    codigo:          baseDatosCentral.codigo,
    codigo_igss:     baseDatosCentral.codigo_igss,
    codigo_ppr:      baseDatosCentral.codigo_ppr,
    nombre:          baseDatosCentral.nombre,
    caracteristicas: baseDatosCentral.caracteristicas,
    presentacion:    baseDatosCentral.presentacion,
    unidad_medida:   baseDatosCentral.unidad_medida,
  }).from(baseDatosCentral).where(inArray(baseDatosCentral.codigo, limpios)).orderBy(baseDatosCentral.codigo_ppr);

  const out: Record<string, PprOpcion[]> = {};
  for (const r of rows) {
    if (!r.codigo) continue;
    (out[r.codigo] ??= []).push(r as PprOpcion);
  }
  return out;
}

// Persiste la presentación/PPR elegida por el usuario para cada renglón de una
// consolidación — se guarda en siaf_compras_items.codigo_ppr (todos los ítems
// que comparten codigo_igss::subproducto dentro de esa consolidación), para
// que quede disponible en la Orden de Compra, el SIAF-04 y su impresión.
export async function guardarPprSeleccion(consolidacionId: number, seleccion: { codigo_igss: string; subproducto: string; codigo_ppr: string }[]): Promise<void> {
  if (seleccion.length === 0) return;
  const siafIds = (await db.select({ id: siafCompras.id }).from(siafCompras)
    .where(eq(siafCompras.consolidacion_id, consolidacionId))).map(s => s.id);
  if (siafIds.length === 0) return;

  for (const s of seleccion) {
    await db.update(siafComprasItems).set({ codigo_ppr: s.codigo_ppr })
      .where(and(
        inArray(siafComprasItems.solicitud_id, siafIds),
        eq(siafComprasItems.codigo_igss, s.codigo_igss),
        eq(siafComprasItems.subproducto, s.subproducto),
      ));
  }
}

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

// Trim + minúsculas + sin tildes, para que "Energía Eléctrica" (Base de
// Datos Central) y "Energia Electrica" (catálogo/SIAF) crucen igual.
export function normalizaNombre(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Mapa codigo_igss::nombre -> unidad de medida vigente en Base de Datos
// Central. catalogo_compras (renglón/subproducto/precio) ya no tiene columna
// de unidad de medida — ese dato vive en base_datos_central (ficha del
// insumo). Muchos insumos sin código real comparten el mismo placeholder de
// codigo_igss (ej. "S/C"), así que no alcanza con cruzar solo por código —
// se agrega el nombre para desambiguar (mismo criterio que ya usa
// SiafClient.tsx al armar sugerencias de insumo). Se usa como respaldo
// cuando el snapshot guardado en siaf_compras_items al crear la solicitud
// quedó vacío y luego se completó en Base de Datos Central.
export async function unidadMedidaLookupMap(): Promise<Map<string, string | null>> {
  const rows = await db.select({
    codigo_igss: baseDatosCentral.codigo_igss, nombre: baseDatosCentral.nombre,
    unidad_medida: baseDatosCentral.unidad_medida,
  }).from(baseDatosCentral).where(isNotNull(baseDatosCentral.codigo_igss));
  const map = new Map<string, string | null>();
  for (const r of rows) if (r.codigo_igss) map.set(`${r.codigo_igss}::${normalizaNombre(r.nombre)}`, r.unidad_medida);
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
