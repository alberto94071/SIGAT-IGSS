"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, usuarios } from "@/lib/schema";
import { desc, asc, inArray } from "drizzle-orm";
import { renglonLookupMap } from "@/lib/adjudicacion/renglon-utils";
import { construirHojaDeRuta } from "@/lib/hoja-de-ruta-actions";
import { resumenEstado } from "@/lib/hoja-de-ruta-utils";

// El archivo de SIAF crece para siempre (nunca se borra) — cargar todo de
// una sola vez tarde o temprano se vuelve una consulta cada vez más pesada.
// Se pagina por lotes ordenados del más reciente al más antiguo; la página
// pide un registro de más para saber si hay más atrás sin otra consulta.
// (Un archivo "use server" solo puede exportar funciones async, así que la
// constante del tamaño de página vive inline, no exportada.)
const ARCHIVO_COMPRAS_PAGE_SIZE = 50;

export type ItemArchivoCompras = {
  id: number; codigo_igss: string | null; nombre: string; subproducto: string;
  cantidad_solicitada: number; renglon: number | null;
};
export type DestinoArchivo = { texto: string; tono: "gray" | "green" | "red" | "amber" | "blue" };
export type SolicitudArchivoCompras = {
  id: number; numero: number; anio: number; fecha: string; estado: string;
  observaciones: string | null;
  creado_por_nombre: string | null;
  motivo_rechazo: string | null; rechazado_por_nombre: string | null; rechazado_en: string | null;
  destino: DestinoArchivo | null;
  items: ItemArchivoCompras[];
};

type SolicitudBase = typeof siafCompras.$inferSelect;

// Compartido entre la carga paginada y la búsqueda — arma items/renglón/
// usuarios/destino para un lote puntual de solicitudes ya elegidas.
async function enriquecerSolicitudesArchivo(solicitudesList: SolicitudBase[]): Promise<SolicitudArchivoCompras[]> {
  if (solicitudesList.length === 0) return [];
  const ids = solicitudesList.map(s => s.id);
  const [itemsList, renglonMap] = await Promise.all([
    db.select().from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, ids)).orderBy(asc(siafComprasItems.id)),
    renglonLookupMap(),
  ]);

  const usuarioIds = [...new Set([
    ...solicitudesList.map(s => s.creado_por), ...solicitudesList.map(s => s.rechazado_por),
  ].filter((v): v is number => v != null))];
  const usuariosList = usuarioIds.length > 0
    ? await db.select({ id: usuarios.id, nombre: usuarios.nombre }).from(usuarios).where(inArray(usuarios.id, usuarioIds))
    : [];
  const usuariosMap = new Map(usuariosList.map(u => [u.id, u.nombre]));

  const hojaDeRuta = await construirHojaDeRuta(ids);
  const destinoMap = new Map(hojaDeRuta.map(h => [h.siaf.id, resumenEstado(h)]));

  return solicitudesList.map(s => ({
    ...s,
    creado_por_nombre: s.creado_por != null ? usuariosMap.get(s.creado_por) ?? null : null,
    rechazado_por_nombre: s.rechazado_por != null ? usuariosMap.get(s.rechazado_por) ?? null : null,
    destino: destinoMap.get(s.id) ?? null,
    items: itemsList.filter(i => i.solicitud_id === s.id).map(i => ({
      ...i, renglon: renglonMap.get(`${i.codigo_igss}::${i.subproducto}::${i.nombre}`) ?? null,
    })),
  }));
}

export async function cargarArchivoCompras(offset: number): Promise<{ solicitudes: SolicitudArchivoCompras[]; hasMore: boolean }> {
  const session = await auth();
  if (!session) return { solicitudes: [], hasMore: false };

  const limit = ARCHIVO_COMPRAS_PAGE_SIZE;
  const pagina = await db.select().from(siafCompras).orderBy(desc(siafCompras.id)).limit(limit + 1).offset(offset);
  const hasMore = pagina.length > limit;
  const solicitudes = await enriquecerSolicitudesArchivo(pagina.slice(0, limit));
  return { solicitudes, hasMore };
}

// El buscador del Archivo solo filtraba lo que YA estaba cargado en el
// cliente (50 a la vez, de más reciente a más antiguo) — con 473 SIAF
// reales en producción, uno viejo (ej. un correlativo bajo, ya Aprobado)
// podía quedar 7-8 páginas atrás, así que escribirlo en el buscador no
// mostraba nada hasta darle "Cargar más" suficientes veces. Reportado por
// el cliente 2026-10-05: "tampoco en la pestaña de archivo me lo muestra,
// si lo escribo. Tengo que buscarlo hasta encontrarlo". Esta función busca
// contra TODA la tabla (siaf_compras no es una de las tablas grandes sin
// filtro — ~500 filas, barato escanearla completa) en vez de depender de
// lo ya paginado en el cliente.
export async function buscarArchivoCompras(query: string): Promise<SolicitudArchivoCompras[]> {
  const session = await auth();
  const q = query.toLowerCase().trim();
  if (!session || !q) return [];

  const [todas, itemsList] = await Promise.all([
    db.select().from(siafCompras).orderBy(desc(siafCompras.id)),
    db.select({ solicitud_id: siafComprasItems.solicitud_id, nombre: siafComprasItems.nombre })
      .from(siafComprasItems),
  ]);
  const itemsPorSolicitud = new Map<number, string[]>();
  for (const i of itemsList) {
    const arr = itemsPorSolicitud.get(i.solicitud_id) ?? [];
    arr.push(i.nombre.toLowerCase());
    itemsPorSolicitud.set(i.solicitud_id, arr);
  }

  const MAX_RESULTADOS = 100;
  const coincidencias = todas.filter(s =>
    `${s.numero}/${s.anio}`.includes(q) ||
    s.fecha.includes(q) ||
    s.estado.toLowerCase().includes(q) ||
    (itemsPorSolicitud.get(s.id) ?? []).some(n => n.includes(q))
  ).slice(0, MAX_RESULTADOS);

  return enriquecerSolicitudesArchivo(coincidencias);
}
