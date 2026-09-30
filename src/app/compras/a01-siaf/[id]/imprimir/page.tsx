import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoFirmantes, configuracion, catalogoCompras } from "@/lib/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { renglonLookupMap, codigoPprLookupMap, codigoPprSinCodigoLookupMap, pprPuroParaImprimir, normalizaNombre, SIN_CODIGO } from "@/lib/adjudicacion/renglon-utils";
import ImprimirClient from "./ImprimirClient";

interface Props { params: Promise<{ id: string }>; searchParams: Promise<{ firmantes?: string; fecha?: string }> }

export default async function ImprimirPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const { firmantes: firmantesParam, fecha: fechaParam } = await searchParams;

  const [solicitud, config, todosFirmantes] = await Promise.all([
    db.select().from(siafCompras).where(eq(siafCompras.id, Number(id))).limit(1),
    db.select().from(configuracion).limit(1),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  if (!solicitud[0]) notFound();

  const items = await db
    .select().from(siafComprasItems)
    .where(eq(siafComprasItems.solicitud_id, Number(id)))
    .orderBy(asc(siafComprasItems.id));

  // El sub-producto solo se imprime junto al insumo si el SIAF trae por lo
  // menos un insumo del renglón 182 — en cualquier otro caso se omite y la
  // descripción ocupa todo el ancho de la casilla.
  const renglones = await renglonLookupMap();
  const mostrarSubproducto = items.some(i =>
    renglones.get(`${i.codigo_igss}::${i.subproducto}::${i.nombre}`) === 182
  );

  // Respaldo del código PPR para SIAFs que todavía no pasaron por la
  // selección de Consolidación (ver comentario en codigoPprLookupMap).
  const codigosItems = [...new Set(
    items.map(i => i.codigo_igss).filter((c): c is string => c != null && c !== SIN_CODIGO)
  )];
  const pprMap = await codigoPprLookupMap(codigosItems);
  // Los ítems "S/C" (sin código real) no tienen codigo_igss por el que
  // buscar — se resuelven aparte, por nombre (ver codigoPprSinCodigoLookupMap).
  const pprSinCodigoMap = await codigoPprSinCodigoLookupMap(
    items.filter(i => i.codigo_ppr == null && (i.codigo_igss == null || i.codigo_igss === SIN_CODIGO))
      .map(i => ({ nombre: i.nombre, descripcion_igss: i.descripcion_igss }))
  );
  // Si el SIAF ya pasó por Consolidación (guardarPprSeleccion), codigo_ppr
  // ya no está vacío — pero ahí guarda la CLAVE COMPUESTA del selector de
  // presentación ("S/C-{id de Base de Datos Central}" o "código-ppr"), no
  // el PPR puro (ver el comentario de pprPuroParaImprimir en renglon-utils.ts).
  // Antes se imprimía ese valor crudo tal cual — mostraba "Código PpR:
  // S/C-199441" en vez del PPR real ("55406 - 65408") — reportado por el
  // cliente 2026-09-17 con dos casos reales (SIAF 20/2026 y 75/2026).
  const pprPuroMap = await pprPuroParaImprimir(items.map(i => i.codigo_ppr));
  // Si el ítem se agregó eligiendo una presentación puntual en el Catálogo
  // (catalogo_compras.codigo_ppr, 2026-09-30, vía `catalogo_id`), ese PPR es
  // exacto — no una adivinanza por nombre — así que tiene prioridad sobre
  // los resolutores de respaldo de abajo (aunque sigue por debajo de
  // `i.codigo_ppr` real, que gana si el SIAF ya pasó por Consolidación).
  // Lookup acotado a los catalogo_id que realmente aparecen en este SIAF,
  // no toda la tabla.
  const catalogoIds = [...new Set(items.map(i => i.catalogo_id).filter((x): x is number => x != null))];
  const catalogoRows = catalogoIds.length > 0
    ? await db.select({ id: catalogoCompras.id, codigo_ppr: catalogoCompras.codigo_ppr })
        .from(catalogoCompras).where(inArray(catalogoCompras.id, catalogoIds))
    : [];
  const catalogoPprMap = new Map(catalogoRows.filter(r => r.codigo_ppr).map(r => [r.id, r.codigo_ppr]));
  const itemsConPpr = items.map(i => {
    if (i.codigo_ppr) return { ...i, codigo_ppr: pprPuroMap.get(i.codigo_ppr) ?? i.codigo_ppr };
    const desdeCatalogo = i.catalogo_id != null ? catalogoPprMap.get(i.catalogo_id) : undefined;
    if (desdeCatalogo) return { ...i, codigo_ppr: desdeCatalogo };
    if (i.codigo_igss && i.codigo_igss !== SIN_CODIGO) {
      return { ...i, codigo_ppr: pprMap.get(`${i.codigo_igss}::${normalizaNombre(i.nombre)}`) ?? pprMap.get(i.codigo_igss) ?? null };
    }
    const clave = `${i.nombre.trim()}::${(i.descripcion_igss ?? "").trim()}`;
    return { ...i, codigo_ppr: pprSinCodigoMap.get(clave) ?? null };
  });

  // Firmantes seleccionados vienen por query param: "1,3"
  const ids = firmantesParam ? firmantesParam.split(",").map(Number).filter(Boolean) : [];
  const firmantesSeleccionados = ids.length > 0
    ? await db.select().from(catalogoFirmantes).where(inArray(catalogoFirmantes.id, ids))
    : [];

  const sol = solicitud[0] as any;
  // Justificación: usa la propia de la solicitud, si no tiene usa la del config
  const justificacion = sol.observaciones || config[0]?.justificacion_siaf || "";
  // Fecha a imprimir: la elige el usuario al abrir "Imprimir" (modal en
  // SiafClient.tsx) — no se guarda, solo cambia lo que sale en el papel; la
  // fecha real de la solicitud (correlativo/año) no se toca.
  if (fechaParam) sol.fecha = fechaParam;

  return (
    <ImprimirClient
      solicitud={sol}
      items={itemsConPpr as any}
      config={{ ...(config[0] as any), justificacion_siaf: justificacion }}
      todosFirmantes={todosFirmantes as any}
      firmantesSeleccionados={firmantesSeleccionados as any}
      mostrarSubproducto={mostrarSubproducto}
      impresoPor={session.user.name ?? session.user.email ?? "Usuario"}
    />
  );
}
