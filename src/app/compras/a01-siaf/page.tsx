import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoCompras, catalogoFirmantes } from "@/lib/schema";
import { desc, asc, eq } from "drizzle-orm";
import { type Rol } from "@/lib/permisos";
import SiafClient from "./SiafClient";

export default async function A01SiafPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rol     = session.user.rol as Rol;
  const canEdit = rol !== "consulta";

  const [solicitudesList, itemsList, catalogoList, firmantesList] = await Promise.all([
    db.select().from(siafCompras).orderBy(desc(siafCompras.id)),
    db.select().from(siafComprasItems).orderBy(asc(siafComprasItems.id)),
    db.select().from(catalogoCompras).where(eq(catalogoCompras.activo, true)),
    db.select({ id: catalogoFirmantes.id, nombre: catalogoFirmantes.nombre, cargo: catalogoFirmantes.cargo })
      .from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  const solicitudes = solicitudesList.map(s => ({
    ...s,
    items: itemsList.filter(i => i.solicitud_id === s.id),
  }));

  return (
    <SiafClient
      solicitudes={solicitudes as any}
      catalogo={catalogoList as any}
      canEdit={canEdit}
      firmantes={firmantesList as any}
    />
  );
}
