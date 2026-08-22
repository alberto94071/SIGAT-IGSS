import { db } from "@/lib/db";
import { catalogoFirmantes } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { requireTabAccess } from "@/lib/modulo-access";
import { cargarArchivoCompras } from "./actions";
import ArchivoClient from "./ArchivoClient";

export default async function ArchivoComprasPage() {
  await requireTabAccess("mod_compras", "tab_compras_archivo");

  const [{ solicitudes, hasMore }, firmantesList] = await Promise.all([
    cargarArchivoCompras(0),
    db.select({ id: catalogoFirmantes.id, nombre: catalogoFirmantes.nombre, cargo: catalogoFirmantes.cargo })
      .from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  return <ArchivoClient solicitudes={solicitudes} hasMore={hasMore} firmantes={firmantesList} />;
}
