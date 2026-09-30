import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoCompras, catalogoFirmantes, usuarios } from "@/lib/schema";
import { desc, asc, eq } from "drizzle-orm";
import { requireTabAccess } from "@/lib/modulo-access";
import { codigoPprLookupMap, codigoPprSinCodigoLookupMap, normalizaNombre, SIN_CODIGO } from "@/lib/adjudicacion/renglon-utils";
import SiafClient from "./SiafClient";

interface Props { searchParams: Promise<{ ver?: string }> }

export default async function A01SiafPage({ searchParams }: Props) {
  const { session, rol } = await requireTabAccess("mod_compras", "tab_compras_a01siaf");

  const { ver } = await searchParams;
  const canEdit = rol !== "consulta";

  const [solicitudesList, itemsList, catalogoList, firmantesList, usuariosList] = await Promise.all([
    db.select().from(siafCompras).orderBy(desc(siafCompras.id)),
    db.select().from(siafComprasItems).orderBy(asc(siafComprasItems.id)),
    db.select().from(catalogoCompras).where(eq(catalogoCompras.activo, true)),
    db.select({ id: catalogoFirmantes.id, nombre: catalogoFirmantes.nombre, cargo: catalogoFirmantes.cargo })
      .from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
    db.select({ id: usuarios.id, nombre: usuarios.nombre }).from(usuarios),
  ]);

  const usuariosMap = new Map(usuariosList.map(u => [u.id, u.nombre]));

  const solicitudes = solicitudesList.map(s => ({
    ...s,
    rechazado_por_nombre: s.rechazado_por != null ? usuariosMap.get(s.rechazado_por) ?? null : null,
    items: itemsList.filter(i => i.solicitud_id === s.id),
  }));

  // PPR "sugerido" (provisional) para ítems que todavía no pasaron por
  // Consolidación (codigo_ppr real sigue null) — mismo resolutor que ya usa
  // la impresión del A-01 SIAF (codigoPprLookupMap/codigoPprSinCodigoLookupMap),
  // solo para mostrarlo en la lista de solicitudes como pista, no como el
  // PPR asignado de verdad (ese solo existe después de Consolidación).
  // `incluirRespaldoLegado: false` — el respaldo legado de
  // codigoPprSinCodigoLookupMap hace una consulta por ítem sin resolver
  // (escaneo completo de Base de Datos Central cada vez, sin índice
  // usable); corriéndolo para TODOS los ítems sin PPR de TODAS las
  // solicitudes en cada carga de esta lista (hasta ~123 en producción)
  // volvió la pantalla notablemente lenta (reportado por el cliente
  // 2026-09-29) — acá solo se usa el match exacto (barato, una sola
  // consulta), y el resolutor completo se deja para la impresión de un
  // solo documento (`imprimir/page.tsx`), donde el N es chico.
  const itemsSinPprAsignado = itemsList.filter(i => i.codigo_ppr == null);
  const codigosReales = [...new Set(
    itemsSinPprAsignado.map(i => i.codigo_igss).filter((c): c is string => c != null && c !== SIN_CODIGO)
  )];
  const [pprRealMap, pprSinCodigoMap] = await Promise.all([
    codigoPprLookupMap(codigosReales),
    codigoPprSinCodigoLookupMap(
      itemsSinPprAsignado
        .filter(i => i.codigo_igss == null || i.codigo_igss === SIN_CODIGO)
        .map(i => ({ nombre: i.nombre, descripcion_igss: i.descripcion_igss })),
      false,
    ),
  ]);
  // Si el ítem se agregó eligiendo una presentación puntual en el Catálogo
  // (catalogo_compras.codigo_ppr, 2026-09-30), ese PPR es exacto — no una
  // adivinanza por nombre — así que tiene prioridad sobre los dos mapas de
  // arriba. `catalogoList` ya está en memoria (broad select de arriba), no
  // hace falta una consulta nueva.
  const catalogoPprMap = new Map(
    catalogoList.filter(c => c.codigo_ppr).map(c => [c.id, c.codigo_ppr])
  );
  const pprSugerido: Record<number, string> = {};
  for (const i of itemsSinPprAsignado) {
    const desdeCatalogo = i.catalogo_id != null ? catalogoPprMap.get(i.catalogo_id) : undefined;
    const v = desdeCatalogo ?? (i.codigo_igss && i.codigo_igss !== SIN_CODIGO
      ? pprRealMap.get(`${i.codigo_igss}::${normalizaNombre(i.nombre)}`)
      : pprSinCodigoMap.get(`${i.nombre.trim()}::${(i.descripcion_igss ?? "").trim()}`));
    if (v) pprSugerido[i.id] = v;
  }

  return (
    <SiafClient
      solicitudes={solicitudes as any}
      catalogo={catalogoList as any}
      canEdit={canEdit}
      firmantes={firmantesList as any}
      verInicial={ver ? Number(ver) : null}
      currentUserName={session.user.name ?? undefined}
      pprSugerido={pprSugerido}
    />
  );
}
