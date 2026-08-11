import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { catalogoFirmantes } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { cargarArchivoCompras } from "./actions";
import ArchivoClient from "./ArchivoClient";

export default async function ArchivoComprasPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [{ solicitudes, hasMore }, firmantesList] = await Promise.all([
    cargarArchivoCompras(0),
    db.select({ id: catalogoFirmantes.id, nombre: catalogoFirmantes.nombre, cargo: catalogoFirmantes.cargo })
      .from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  return <ArchivoClient solicitudes={solicitudes} hasMore={hasMore} firmantes={firmantesList} />;
}
