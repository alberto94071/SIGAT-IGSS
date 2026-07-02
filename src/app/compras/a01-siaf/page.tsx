import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoCompras, catalogoFirmantes, usuarios } from "@/lib/schema";
import { desc, asc, eq } from "drizzle-orm";
import { type Rol } from "@/lib/permisos";
import SiafClient from "./SiafClient";

interface Props { searchParams: Promise<{ ver?: string }> }

export default async function A01SiafPage({ searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { ver } = await searchParams;
  const rol     = session.user.rol as Rol;
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

  return (
    <SiafClient
      solicitudes={solicitudes as any}
      catalogo={catalogoList as any}
      canEdit={canEdit}
      firmantes={firmantesList as any}
      verInicial={ver ? Number(ver) : null}
      currentUserName={session.user.name ?? undefined}
    />
  );
}
