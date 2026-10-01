import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoCompras, baseDatosCentral } from "@/lib/schema";
import { asc, inArray } from "drizzle-orm";
import {
  SIN_CODIGO, codigoPprLookupMap, codigoPprSinCodigoLookupMap,
  normalizaNombre, pprPuroParaImprimir,
} from "@/lib/adjudicacion/renglon-utils";

export type FilaReporteA01Siaf = {
  siaf_id: number;
  siaf_numero: number;
  siaf_anio: number;
  siaf_fecha: string;
  siaf_estado: string;
  item_id: number;
  insumo: string;
  subproducto: string;
  renglon: number | null;
  codigo_o_ppr: string;
  es_ppr: boolean;
  cantidad: number;
  caracteristicas: string | null;
  presentacion: string | null;
  unidad_medida: string | null;
};

// Reporte "control de SIAF" (Reportes → Compras, 2026-10-01, pedido urgente
// del cliente: "un reporte... de todos los siafs que se han generado desde
// el principio, desde el 1 hasta el último... para saber y controlar el día
// de hoy todos los SIAF que ya he hecho"). Una fila por ítem de cada A-01
// SIAF — de TODOS los estados (Borrador/Aprobado/Rechazado/Consolidado), de
// todos los años. No filtra nada: el propósito del reporte es justamente
// poder auditar visualmente si falta algo.
export async function getReporteA01SiafCompleto(): Promise<FilaReporteA01Siaf[]> {
  const [solicitudes, items, catalogo] = await Promise.all([
    db.select().from(siafCompras).orderBy(asc(siafCompras.anio), asc(siafCompras.numero)),
    db.select().from(siafComprasItems).orderBy(asc(siafComprasItems.id)),
    // Sin filtrar por `activo` — un ítem histórico puede referenciar una fila
    // del catálogo ya desactivada, y igual necesitamos su renglón/PPR reales.
    db.select({ id: catalogoCompras.id, renglon: catalogoCompras.renglon, codigo_ppr: catalogoCompras.codigo_ppr })
      .from(catalogoCompras),
  ]);
  if (items.length === 0) return [];

  const siafMap = new Map(solicitudes.map(s => [s.id, s]));
  const catalogoMap = new Map(catalogo.map(c => [c.id, c]));

  // Mismo criterio de prioridad que ya usa compras/a01-siaf/page.tsx e
  // imprimir/page.tsx para la leyenda "Código PpR:": 1) Consolidación real
  // (siaf_compras_items.codigo_ppr, una clave compuesta que hay que resolver
  // con pprPuroParaImprimir, no el PPR puro), 2) PPR exacto elegido en el
  // Catálogo (vía catalogo_id, sentinel "" = sin distinguir, no cuenta),
  // 3) adivinanza por nombre contra Base de Datos Central.
  const pprPuroMap = await pprPuroParaImprimir(items.map(i => i.codigo_ppr));

  const itemsSinPprReal = items.filter(i => {
    if (i.codigo_ppr && pprPuroMap.has(i.codigo_ppr)) return false;
    const cat = i.catalogo_id != null ? catalogoMap.get(i.catalogo_id) : undefined;
    return !cat?.codigo_ppr;
  });
  const codigosReales = [...new Set(
    itemsSinPprReal.map(i => i.codigo_igss).filter((c): c is string => c != null && c !== SIN_CODIGO)
  )];
  const [pprRealMap, pprSinCodigoMap] = await Promise.all([
    codigoPprLookupMap(codigosReales),
    // incluirRespaldoLegado=false: este reporte puede traer cientos de ítems
    // históricos de golpe — el respaldo legado hace una consulta por ítem sin
    // resolver, carísimo a esta escala (mismo problema ya corregido en
    // a01-siaf/page.tsx el 2026-09-29, ver CLAUDE.md).
    codigoPprSinCodigoLookupMap(
      itemsSinPprReal.filter(i => i.codigo_igss == null || i.codigo_igss === SIN_CODIGO)
        .map(i => ({ nombre: i.nombre, descripcion_igss: i.descripcion_igss })),
      false,
    ),
  ]);

  const pprPorItem = new Map<number, string | null>();
  for (const i of items) {
    if (i.codigo_ppr && pprPuroMap.has(i.codigo_ppr)) { pprPorItem.set(i.id, pprPuroMap.get(i.codigo_ppr)!); continue; }
    const cat = i.catalogo_id != null ? catalogoMap.get(i.catalogo_id) : undefined;
    if (cat?.codigo_ppr) { pprPorItem.set(i.id, cat.codigo_ppr); continue; }
    const v = i.codigo_igss && i.codigo_igss !== SIN_CODIGO
      ? pprRealMap.get(`${i.codigo_igss}::${normalizaNombre(i.nombre)}`)
      : pprSinCodigoMap.get(`${i.nombre.trim()}::${(i.descripcion_igss ?? "").trim()}`);
    pprPorItem.set(i.id, v ?? null);
  }

  // Una sola consulta a Base de Datos Central por todos los PPR resueltos —
  // nunca sin filtro (tabla de ~208k filas, ver "Trampas del entorno" en CLAUDE.md).
  const pprsResueltos = [...new Set([...pprPorItem.values()].filter((v): v is string => v != null))];
  const bdcRows = pprsResueltos.length > 0
    ? await db.select({
        codigo_ppr: baseDatosCentral.codigo_ppr, caracteristicas: baseDatosCentral.caracteristicas,
        presentacion: baseDatosCentral.presentacion, unidad_medida: baseDatosCentral.unidad_medida,
        renglon: baseDatosCentral.renglon,
      }).from(baseDatosCentral).where(inArray(baseDatosCentral.codigo_ppr, pprsResueltos))
    : [];
  const bdcMap = new Map(bdcRows.map(r => [r.codigo_ppr!, r]));

  const filas: FilaReporteA01Siaf[] = [];
  for (const i of items) {
    const siaf = siafMap.get(i.solicitud_id);
    if (!siaf) continue;
    const cat = i.catalogo_id != null ? catalogoMap.get(i.catalogo_id) : undefined;
    const ppr = pprPorItem.get(i.id) ?? null;
    const bdc = ppr ? bdcMap.get(ppr) : undefined;
    filas.push({
      siaf_id: siaf.id,
      siaf_numero: siaf.numero,
      siaf_anio: siaf.anio,
      siaf_fecha: siaf.fecha,
      siaf_estado: siaf.estado,
      item_id: i.id,
      insumo: i.descripcion_igss || i.nombre,
      subproducto: i.subproducto,
      renglon: cat?.renglon ?? bdc?.renglon ?? null,
      codigo_o_ppr: ppr ?? (i.codigo_igss && i.codigo_igss !== SIN_CODIGO ? i.codigo_igss : SIN_CODIGO),
      es_ppr: ppr != null,
      cantidad: i.cantidad_solicitada,
      caracteristicas: bdc?.caracteristicas ?? null,
      presentacion: bdc?.presentacion ?? null,
      unidad_medida: bdc?.unidad_medida ?? null,
    });
  }

  // Más reciente primero (año desc, número desc) — es como se lee la lista
  // real de A-01 SIAF hoy; dentro de cada SIAF, en el orden en que se
  // agregaron los ítems.
  filas.sort((a, b) => b.siaf_anio - a.siaf_anio || b.siaf_numero - a.siaf_numero || a.item_id - b.item_id);
  return filas;
}
