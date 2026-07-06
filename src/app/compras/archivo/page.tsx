import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoFirmantes } from "@/lib/schema";
import { desc, asc, eq } from "drizzle-orm";
import ArchivoClient from "./ArchivoClient";

export default async function ArchivoComprasPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [solicitudesList, itemsList, firmantesList] = await Promise.all([
    db.select().from(siafCompras).orderBy(desc(siafCompras.id)),
    db.select().from(siafComprasItems).orderBy(asc(siafComprasItems.id)),
    db.select({ id: catalogoFirmantes.id, nombre: catalogoFirmantes.nombre, cargo: catalogoFirmantes.cargo })
      .from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  const solicitudes = solicitudesList.map(s => ({
    ...s,
    items: itemsList.filter(i => i.solicitud_id === s.id),
  }));

  return <ArchivoClient solicitudes={solicitudes} firmantes={firmantesList} />;
}
