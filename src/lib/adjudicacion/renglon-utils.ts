import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoCompras, baseDatosCentral } from "@/lib/schema";
import { eq, and, or, inArray, ilike, isNotNull } from "drizzle-orm";

// ─── PPR (presentación) por código base ──────────────────────────────────────
// Un mismo insumo puede tener varias presentaciones/PPR registradas en Base de
// Datos Central (galón, litro, unidad...), cada una con su propio codigo_ppr.
// El campo que las agrupa no es siempre el mismo: para algunos insumos (ej.
// combustible) el "código" (base_datos_central.codigo) es el que se repite
// entre presentaciones; para otros (ej. medicamentos, cargados antes de que
// existiera este selector) lo que ya venía guardado como codigo_igss en
// catalogo_compras/siaf_compras_items es en realidad el valor compartido de
// base_datos_central.codigo_igss, no de .codigo. Por eso se busca por ambos
// campos a la vez.
//
// "S/C" (sin código) es un caso aparte: NO es un código compartido de un
// mismo insumo con varias presentaciones — es un marcador que usan muchos
// insumos distintos entre sí (ej. Energía Eléctrica de varios períodos,
// Agua, servicios de Casos de Excepción) para decir "no tiene código". Si se
// agrupara por "S/C" como si fuera un código real, terminarían mezclados
// insumos que no tienen nada que ver — para esos, lo único que realmente
// distingue uno de otro es el nombre + el renglón (base_datos_central no
// tiene columna de sub-producto).
export type PprOpcion = {
  id: number; codigo: string | null; codigo_igss: string | null; codigo_ppr: number | null;
  nombre: string; descripcion_igss: string | null;
  caracteristicas: string | null; presentacion: string | null; unidad_medida: string | null;
};

export type ItemParaPpr = { codigo_igss: string | null; nombre: string; renglon: number | null };

const SIN_CODIGO = "S/C";

function tieneCodigoReal(codigoIgss: string | null): boolean {
  return !!codigoIgss && codigoIgss !== SIN_CODIGO;
}

// Misma clave en el servidor (acá) y en el cliente (ver clavePprDeItem
// duplicada en OrdenesClient.tsx/Siaf04Client.tsx) — así ambos lados
// concuerdan en cómo indexar el resultado sin tener que compartir código
// que dependa de la base de datos.
export function clavePprDeItem(r: ItemParaPpr): string {
  return tieneCodigoReal(r.codigo_igss) ? r.codigo_igss! : `${r.nombre.trim().toLowerCase()}::${r.renglon ?? ""}`;
}

const SELECT_COLUMNAS = {
  id:               baseDatosCentral.id,
  codigo:           baseDatosCentral.codigo,
  codigo_igss:      baseDatosCentral.codigo_igss,
  codigo_ppr:       baseDatosCentral.codigo_ppr,
  nombre:           baseDatosCentral.nombre,
  descripcion_igss: baseDatosCentral.descripcion_igss,
  caracteristicas:  baseDatosCentral.caracteristicas,
  presentacion:     baseDatosCentral.presentacion,
  unidad_medida:    baseDatosCentral.unidad_medida,
  renglon:          baseDatosCentral.renglon,
};

// Trae, para cada renglón/insumo de la lista, todas sus presentaciones/PPR
// registradas en Base de Datos Central — para poblar el selector de PPR al
// generar la Orden de Compra o el SIAF-04. El resultado queda indexado por
// clavePprDeItem(item), para poder cruzarlo directo con el renglón.
export async function getPprsPorItems(items: ItemParaPpr[]): Promise<Record<string, PprOpcion[]>> {
  const out: Record<string, PprOpcion[]> = {};

  const conCodigo = items.filter(i => tieneCodigoReal(i.codigo_igss));
  const codigosReales = [...new Set(conCodigo.map(i => i.codigo_igss!))];
  if (codigosReales.length > 0) {
    const rows = await db.select(SELECT_COLUMNAS).from(baseDatosCentral)
      .where(or(inArray(baseDatosCentral.codigo, codigosReales), inArray(baseDatosCentral.codigo_igss, codigosReales)))
      .orderBy(baseDatosCentral.codigo_ppr);
    for (const codigo of codigosReales) {
      const opciones = rows.filter(r => r.codigo === codigo || r.codigo_igss === codigo);
      if (opciones.length > 0) out[codigo] = opciones;
    }
  }

  const sinCodigo = items.filter(i => !tieneCodigoReal(i.codigo_igss));
  if (sinCodigo.length > 0) {
    const nombresUnicos = [...new Set(sinCodigo.map(i => i.nombre.trim()).filter(n => n.length > 0))];
    if (nombresUnicos.length > 0) {
      const rows = await db.select(SELECT_COLUMNAS).from(baseDatosCentral)
        .where(or(...nombresUnicos.map(n => ilike(baseDatosCentral.nombre, n))))
        .orderBy(baseDatosCentral.codigo_ppr);
      for (const item of sinCodigo) {
        const nombreItem = item.nombre.trim().toLowerCase();
        const opciones = rows.filter(r =>
          r.nombre.trim().toLowerCase() === nombreItem && (item.renglon == null || r.renglon === item.renglon)
        );
        if (opciones.length > 0) out[clavePprDeItem(item)] = opciones;
      }
    }
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

// Mismo cruce que unidadMedidaLookupMap, pero para "codigo" (columna aparte de
// Base de Datos Central, distinta de código IGSS y de código PPR) — es la que
// se imprime en la columna "CODIGO" del DAB-60.
export async function codigoLookupMap(): Promise<Map<string, string | null>> {
  const rows = await db.select({
    codigo_igss: baseDatosCentral.codigo_igss, nombre: baseDatosCentral.nombre,
    codigo: baseDatosCentral.codigo,
  }).from(baseDatosCentral).where(isNotNull(baseDatosCentral.codigo_igss));
  const map = new Map<string, string | null>();
  for (const r of rows) if (r.codigo_igss) map.set(`${r.codigo_igss}::${normalizaNombre(r.nombre)}`, r.codigo);
  return map;
}

export type GrupoRenglon = {
  renglon: number | null; codigo_igss: string | null; codigo_ppr: string | null; subproducto: string;
  nombre: string; cantidad: number; total: number;
  unidad_medida: string | null; codigo: string | null;
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

  const [unidades, codigos] = await Promise.all([unidadMedidaLookupMap(), codigoLookupMap()]);

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
    else {
      const fichaKey = `${item.codigo_igss}::${normalizaNombre(item.nombre)}`;
      grupos.set(key, {
        renglon, codigo_igss: item.codigo_igss, codigo_ppr: item.codigo_ppr,
        subproducto: item.subproducto, nombre: item.nombre, cantidad: item.cantidad_solicitada,
        total: itemTotal,
        unidad_medida: unidades.get(fichaKey) ?? null,
        codigo: codigos.get(fichaKey) ?? null,
      });
    }
  }
  return Array.from(grupos.values());
}

// Correlativos ("numero/anio") de las solicitudes A-01 SIAF consolidadas en
// una orden de compra — para imprimirlos en el DAB-60 ("A-01 SIAF: ###/AAAA").
export async function siafCorrelativosDeConsolidacion(consolidacionId: number): Promise<string[]> {
  const rows = await db.select({ numero: siafCompras.numero, anio: siafCompras.anio }).from(siafCompras)
    .where(eq(siafCompras.consolidacion_id, consolidacionId));
  return [...new Set(rows.map(r => `${r.numero}/${r.anio}`))];
}
