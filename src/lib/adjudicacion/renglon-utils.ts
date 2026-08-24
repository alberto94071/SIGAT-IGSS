import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoCompras, baseDatosCentral } from "@/lib/schema";
import { eq, and, or, inArray, ilike, isNotNull, isNull } from "drizzle-orm";

// ─── PPR (presentación) por código base ──────────────────────────────────────
// Un mismo insumo puede tener varias presentaciones/PPR registradas en Base de
// Datos Central (galón, litro, unidad...), cada una con su propio codigo_ppr
// (formato "número - número", único por fila — reimportado 2026-08-23 desde
// el Excel limpio del cliente; antes de eso codigo_ppr traía un número
// pequeño mal mapeado, ver CLAUDE.md). Base de Datos Central ya no tiene un
// campo "código" separado de codigo_igss (se eliminó esa duplicación en la
// misma reimportación) — codigo_igss es el único campo de código real, y
// existe solo para el ~15% de las filas que sí lo tienen.
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
  id: number; codigo: string | null; codigo_igss: string | null; codigo_ppr: string | null;
  nombre: string; descripcion_igss: string | null;
  caracteristicas: string | null; presentacion: string | null; unidad_medida: string | null;
};

export type ItemParaPpr = { codigo_igss: string | null; nombre: string; renglon: number | null };

export const SIN_CODIGO = "S/C";

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
  codigo:           baseDatosCentral.codigo_igss,
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
    // También se busca por codigo_ppr, no solo por codigo_igss: los
    // catalogo_compras/siaf_compras_items creados ANTES de la reimportación
    // de Base de Datos Central (2026-08-23) guardaron en su propio
    // codigo_igss el valor "número - número" que en ESA época venía en la
    // columna codigo_igss de la BDC vieja (un placeholder de importación) —
    // ese mismo valor, confirmado contra el catálogo real, es exactamente
    // el codigo_ppr de esa fila en la BDC nueva. Sin este fallback, esos
    // insumos (ej. "Escritorio en L", código "108241 - 125834") no
    // encuentran ninguna opción aunque sí exista una sola fila exacta.
    const rows = await db.select(SELECT_COLUMNAS).from(baseDatosCentral)
      .where(or(inArray(baseDatosCentral.codigo_igss, codigosReales), inArray(baseDatosCentral.codigo_ppr, codigosReales)))
      .orderBy(baseDatosCentral.codigo_ppr);
    for (const codigo of codigosReales) {
      const opciones = rows.filter(r => r.codigo_igss === codigo || r.codigo_ppr === codigo);
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
// que comparten codigo_igss::subproducto::nombre dentro de esa consolidación),
// para que quede disponible en la Orden de Compra, el SIAF-04 y su impresión.
// El nombre entra al WHERE por la misma razón que en el resto del código: un
// codigo_igss "S/C" se reutiliza entre insumos distintos que comparten
// subproducto — sin el nombre, guardar el PPR de uno pisaba el de otro.
export async function guardarPprSeleccion(consolidacionId: number, seleccion: { codigo_igss: string; subproducto: string; nombre: string; codigo_ppr: string; descripcion_igss?: string | null }[]): Promise<void> {
  if (seleccion.length === 0) return;
  const siafIds = (await db.select({ id: siafCompras.id }).from(siafCompras)
    .where(eq(siafCompras.consolidacion_id, consolidacionId))).map(s => s.id);
  if (siafIds.length === 0) return;

  for (const s of seleccion) {
    // descripcion_igss (si se manda) es la de la presentación elegida, NO la
    // genérica que ya traía el ítem desde el catálogo/PAC — sobreescribe ese
    // snapshot para que la impresión (ej. SIAF-04) muestre la descripción de
    // lo que el usuario realmente eligió, no la del insumo en general.
    const valores: { codigo_ppr: string; descripcion_igss?: string } = { codigo_ppr: s.codigo_ppr };
    if (s.descripcion_igss) valores.descripcion_igss = s.descripcion_igss;
    await db.update(siafComprasItems).set(valores)
      .where(and(
        inArray(siafComprasItems.solicitud_id, siafIds),
        eq(siafComprasItems.codigo_igss, s.codigo_igss),
        eq(siafComprasItems.subproducto, s.subproducto),
        eq(siafComprasItems.nombre, s.nombre),
      ));
  }
}

// Mapa completo codigo_igss::subproducto::nombre -> renglón, para anotar
// listas de ítems ya cargadas sin hacer una consulta por ítem (mismo cruce
// que usa la automatización de pre-compromiso, pero en un solo query). El
// nombre es parte de la clave porque el PAC reutiliza un mismo sub-producto
// para varios insumos sin código real (ver catalogoCompras en schema.ts) —
// sin el nombre, dos insumos distintos bajo el mismo sub-producto pisarían
// la entrada del otro en este mapa.
export async function renglonLookupMap(): Promise<Map<string, number | null>> {
  const rows = await db.select({
    codigo_igss: catalogoCompras.codigo_igss, subproducto: catalogoCompras.subproducto,
    nombre: catalogoCompras.nombre, renglon: catalogoCompras.renglon,
  }).from(catalogoCompras);
  const map = new Map<string, number | null>();
  for (const r of rows) map.set(`${r.codigo_igss}::${r.subproducto}::${r.nombre}`, r.renglon);
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
// `codigos`, si se pasa, limita la consulta a esos codigo_igss — Base de
// Datos Central tiene ~200 mil filas (catálogo nacional IGSS), así que traer
// la tabla completa en cada impresión de DAB-60/A-04 o cada carga de listas
// de consolidaciones ya no es viable; el llamador conoce de antemano qué
// códigos necesita (los de los ítems que está resolviendo).
// Trae, para una lista de códigos (valores que YA vienen guardados como
// codigo_igss en catalogo_compras/siaf_compras_items), las filas de Base de
// Datos Central que matchean — por codigo_igss real (`código::nombre`,
// ambiguo por sí solo, requiere nombre porque un mismo código real puede
// cubrir varios nombres distintos) O por codigo_ppr (sin ambigüedad posible,
// es único en toda la tabla: ver comentario de getPprsPorItems arriba sobre
// por qué un código guardado antes de la reimportación 2026-08-23 puede
// coincidir con un codigo_ppr de hoy en vez de con un codigo_igss).
async function filasPorCodigoIgssOPpr(codigos?: string[]) {
  return db.select({
    codigo_igss: baseDatosCentral.codigo_igss, codigo_ppr: baseDatosCentral.codigo_ppr,
    nombre: baseDatosCentral.nombre, unidad_medida: baseDatosCentral.unidad_medida,
  }).from(baseDatosCentral).where(codigos
    ? or(
        and(isNotNull(baseDatosCentral.codigo_igss), inArray(baseDatosCentral.codigo_igss, codigos)),
        inArray(baseDatosCentral.codigo_ppr, codigos),
      )
    : isNotNull(baseDatosCentral.codigo_igss));
}

export async function unidadMedidaLookupMap(codigos?: string[]): Promise<Map<string, string | null>> {
  if (codigos && codigos.length === 0) return new Map();
  const rows = await filasPorCodigoIgssOPpr(codigos);
  const map = new Map<string, string | null>();
  for (const r of rows) {
    if (r.codigo_igss) map.set(`${r.codigo_igss}::${normalizaNombre(r.nombre)}`, r.unidad_medida);
    if (r.codigo_ppr && codigos?.includes(r.codigo_ppr)) map.set(r.codigo_ppr, r.unidad_medida);
  }
  return map;
}

// Mismo cruce que unidadMedidaLookupMap, para "código" (el que se imprime en
// la columna "CODIGO" del DAB-60) — desde la reimportación 2026-08-23, Base
// de Datos Central ya no tiene una columna "codigo" separada de codigo_igss,
// así que este mapa devuelve codigo_igss (se mantiene como función propia
// porque el llamador la usa con esa forma/nombre).
export async function codigoLookupMap(codigos?: string[]): Promise<Map<string, string | null>> {
  if (codigos && codigos.length === 0) return new Map();
  const rows = await filasPorCodigoIgssOPpr(codigos);
  const map = new Map<string, string | null>();
  for (const r of rows) {
    if (r.codigo_igss) map.set(`${r.codigo_igss}::${normalizaNombre(r.nombre)}`, r.codigo_igss);
    if (r.codigo_ppr && codigos?.includes(r.codigo_ppr)) map.set(r.codigo_ppr, r.codigo_ppr);
  }
  return map;
}

// Mismo cruce que unidadMedidaLookupMap/codigoLookupMap, para la leyenda
// "Código PpR: ..." que se imprime en el A-01 SIAF (renglones que no son
// 182, ver textoCodigosPpr en ImprimirClient.tsx) cuando el ítem todavía no
// tiene codigo_ppr propio (ese campo de siaf_compras_items solo se llena en
// Consolidación, vía guardarPprSeleccion — un SIAF recién creado no pasó por
// ahí todavía). Devuelve baseDatosCentral.codigo_ppr directamente — desde la
// reimportación 2026-08-23 ese campo SÍ es el código PPR correcto (formato
// "número - número", confirmado por el cliente); antes de eso traía un valor
// mal mapeado y por eso esta función usaba la columna "Código" como parche.
export async function codigoPprLookupMap(codigos?: string[]): Promise<Map<string, string | null>> {
  if (codigos && codigos.length === 0) return new Map();
  const rows = await filasPorCodigoIgssOPpr(codigos);
  const map = new Map<string, string | null>();
  for (const r of rows) {
    if (r.codigo_igss) map.set(`${r.codigo_igss}::${normalizaNombre(r.nombre)}`, r.codigo_ppr ?? null);
    if (r.codigo_ppr && codigos?.includes(r.codigo_ppr)) map.set(r.codigo_ppr, r.codigo_ppr);
  }
  return map;
}

// Mismo respaldo que codigoPprLookupMap, pero para ítems SIN código real
// (S/C) — ahí no hay codigo_igss por el que buscar, así que se busca por
// nombre. Un mismo nombre puede tener cientos de presentaciones distintas
// en Base de Datos Central (ej. "Planta generadora de electricidad" con 272
// variantes, cada una con su propio codigo_ppr) — para no imprimir el PPR
// de una presentación equivocada, solo se resuelve cuando es inequívoco:
// hay una sola presentación con ese nombre, o la descripción completa
// (nombre + características) coincide exacta con alguna — que es
// justamente el formato que arma elegirInsumo (CatalogoComprasClient.tsx)
// al agregar el insumo, así que los insumos agregados por ese camino
// siempre matchean.
export async function codigoPprSinCodigoLookupMap(
  items: { nombre: string; descripcion_igss: string | null }[]
): Promise<Map<string, string>> {
  const nombresUnicos = [...new Set(items.map(i => i.nombre.trim()).filter(n => n.length > 0))];
  if (nombresUnicos.length === 0) return new Map();
  const rows = await db.select({
    nombre: baseDatosCentral.nombre, codigo_ppr: baseDatosCentral.codigo_ppr, caracteristicas: baseDatosCentral.caracteristicas,
  }).from(baseDatosCentral).where(
    and(isNull(baseDatosCentral.codigo_igss), or(...nombresUnicos.map(n => ilike(baseDatosCentral.nombre, n))))
  );

  const porNombre = new Map<string, { codigo_ppr: string; caracteristicas: string | null }[]>();
  for (const r of rows) {
    if (!r.codigo_ppr) continue;
    const key = r.nombre.trim().toLowerCase();
    if (!porNombre.has(key)) porNombre.set(key, []);
    porNombre.get(key)!.push({ codigo_ppr: r.codigo_ppr, caracteristicas: r.caracteristicas });
  }

  const map = new Map<string, string>();
  for (const item of items) {
    const candidatos = porNombre.get(item.nombre.trim().toLowerCase()) ?? [];
    if (candidatos.length === 0) continue;
    const descripcionCompleta = (item.descripcion_igss ?? "").trim();
    const elegido = candidatos.length === 1
      ? candidatos[0]
      : candidatos.find(c => `${item.nombre.trim()}; ${c.caracteristicas ?? ""}`.trim() === descripcionCompleta);
    if (elegido) map.set(`${item.nombre.trim()}::${descripcionCompleta}`, elegido.codigo_ppr);
  }
  return map;
}

export type GrupoRenglon = {
  renglon: number | null; codigo_igss: string | null; codigo_ppr: string | null; subproducto: string;
  nombre: string; cantidad: number; total: number;
  unidad_medida: string | null; codigo: string | null; descripcion_igss: string | null;
};

// Agrupa los insumos de los SIAF consolidados de una consolidación por
// renglón + subproducto + nombre (misma terna identidad que usa el resto del
// código — ver catalogo_compras_codigo_subproducto_idx en schema.ts). No
// alcanza con código+subproducto solos: el PAC reutiliza un mismo
// subproducto para varios insumos "S/C" sin código real (ej. Agua y Energía
// Eléctrica, cada mes, todos bajo el mismo subproducto) — agrupar sin el
// nombre mezclaría esos insumos distintos en una sola fila.
export async function gruposRenglonDeConsolidacion(consolidacionId: number): Promise<GrupoRenglon[]> {
  const siafIds = (await db.select({ id: siafCompras.id }).from(siafCompras)
    .where(eq(siafCompras.consolidacion_id, consolidacionId))).map(s => s.id);
  if (siafIds.length === 0) return [];

  const items = await db.select({
    codigo_igss:         siafComprasItems.codigo_igss,
    codigo_ppr:          siafComprasItems.codigo_ppr,
    subproducto:         siafComprasItems.subproducto,
    nombre:              siafComprasItems.nombre,
    unidad_medida:       siafComprasItems.unidad_medida,
    cantidad_solicitada: siafComprasItems.cantidad_solicitada,
    precio_unitario:     siafComprasItems.precio_unitario,
    descripcion_igss:    siafComprasItems.descripcion_igss,
  }).from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds));

  // Un solo query para el catálogo completo (misma tabla que ya carga
  // renglonLookupMap) en vez de una consulta por ítem — antes esto era un
  // N+1 clásico: una solicitud consolidada con muchos insumos distintos
  // disparaba una consulta a catalogo_compras por cada uno. Los lookups de
  // Base de Datos Central se acotan a los codigo_igss de esta consolidación
  // (esa tabla tiene ~200 mil filas — el catálogo nacional IGSS — así que
  // traerla completa en cada impresión no escala).
  const codigosIgss = [...new Set(items.map(i => i.codigo_igss).filter((c): c is string => c != null))];
  const [unidades, codigos, renglones] = await Promise.all([
    unidadMedidaLookupMap(codigosIgss), codigoLookupMap(codigosIgss), renglonLookupMap(),
  ]);

  const grupos = new Map<string, GrupoRenglon>();
  for (const item of items) {
    const renglon = item.codigo_igss != null
      ? renglones.get(`${item.codigo_igss}::${item.subproducto}::${item.nombre}`) ?? null
      : null;
    const key = `${item.codigo_igss}::${item.subproducto}::${item.nombre}`;
    const itemTotal = item.cantidad_solicitada * (item.precio_unitario ?? 0);
    const existente = grupos.get(key);
    if (existente) {
      existente.cantidad += item.cantidad_solicitada;
      existente.total += itemTotal;
    }
    else {
      const fichaKey = `${item.codigo_igss}::${normalizaNombre(item.nombre)}`;
      // Si no matchea por codigo_igss::nombre, se intenta el código crudo
      // solo (cubre el caso de items guardados antes de la reimportación de
      // Base de Datos Central, cuyo codigo_igss es en realidad un codigo_ppr
      // de la base nueva — ver comentario en filasPorCodigoIgssOPpr).
      grupos.set(key, {
        renglon, codigo_igss: item.codigo_igss, codigo_ppr: item.codigo_ppr,
        subproducto: item.subproducto, nombre: item.nombre, cantidad: item.cantidad_solicitada,
        total: itemTotal,
        // El snapshot guardado al crear el SIAF (item.unidad_medida) tiene
        // prioridad — Base de Datos Central solo se usa de respaldo cuando
        // ese snapshot vino vacío (ver mismo patrón en a01-siaf/actions.ts),
        // y su búsqueda además exige codigo_igss real, así que nunca cubre
        // insumos "S/C".
        unidad_medida: item.unidad_medida?.trim() || unidades.get(fichaKey) || unidades.get(item.codigo_igss ?? "") || null,
        codigo: codigos.get(fichaKey) ?? codigos.get(item.codigo_igss ?? "") ?? null,
        descripcion_igss: item.descripcion_igss ?? null,
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
