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

export async function cargarArchivoCompras(offset: number): Promise<{ solicitudes: SolicitudArchivoCompras[]; hasMore: boolean }> {
  const session = await auth();
  if (!session) return { solicitudes: [], hasMore: false };

  const limit = ARCHIVO_COMPRAS_PAGE_SIZE;
  const pagina = await db.select().from(siafCompras).orderBy(desc(siafCompras.id)).limit(limit + 1).offset(offset);
  const hasMore = pagina.length > limit;
  const solicitudesList = pagina.slice(0, limit);
  if (solicitudesList.length === 0) return { solicitudes: [], hasMore: false };

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

  const solicitudes = solicitudesList.map(s => ({
    ...s,
    creado_por_nombre: s.creado_por != null ? usuariosMap.get(s.creado_por) ?? null : null,
    rechazado_por_nombre: s.rechazado_por != null ? usuariosMap.get(s.rechazado_por) ?? null : null,
    destino: destinoMap.get(s.id) ?? null,
    items: itemsList.filter(i => i.solicitud_id === s.id).map(i => ({
      ...i, renglon: renglonMap.get(`${i.codigo_igss}::${i.subproducto}::${i.nombre}`) ?? null,
    })),
  }));

  return { solicitudes, hasMore };
}
