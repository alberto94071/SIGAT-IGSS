import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoFirmantes, usuarios } from "@/lib/schema";
import { desc, asc, eq, inArray } from "drizzle-orm";
import { renglonLookupMap } from "@/lib/adjudicacion/renglon-utils";
import ArchivoClient from "./ArchivoClient";

export default async function ArchivoComprasPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [solicitudesList, itemsList, firmantesList, renglonMap] = await Promise.all([
    db.select().from(siafCompras).orderBy(desc(siafCompras.id)),
    db.select().from(siafComprasItems).orderBy(asc(siafComprasItems.id)),
    db.select({ id: catalogoFirmantes.id, nombre: catalogoFirmantes.nombre, cargo: catalogoFirmantes.cargo })
      .from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
    renglonLookupMap(),
  ]);

  const usuarioIds = [...new Set([
    ...solicitudesList.map(s => s.creado_por), ...solicitudesList.map(s => s.rechazado_por),
  ].filter((v): v is number => v != null))];
  const usuariosList = usuarioIds.length > 0
    ? await db.select({ id: usuarios.id, nombre: usuarios.nombre }).from(usuarios).where(inArray(usuarios.id, usuarioIds))
    : [];
  const usuariosMap = new Map(usuariosList.map(u => [u.id, u.nombre]));

  const solicitudes = solicitudesList.map(s => ({
    ...s,
    creado_por_nombre: s.creado_por != null ? usuariosMap.get(s.creado_por) ?? null : null,
    rechazado_por_nombre: s.rechazado_por != null ? usuariosMap.get(s.rechazado_por) ?? null : null,
    items: itemsList.filter(i => i.solicitud_id === s.id).map(i => ({
      ...i, renglon: renglonMap.get(`${i.codigo_igss}::${i.subproducto}`) ?? null,
    })),
  }));

  return <ArchivoClient solicitudes={solicitudes} firmantes={firmantesList} />;
}
