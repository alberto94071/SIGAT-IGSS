import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { catalogoInsumos } from "@/lib/schema";
import { redirect } from "next/navigation";
import { parsePermisos, type Rol } from "@/lib/permisos";
import { asc } from "drizzle-orm";
import CatalogosClient from "./CatalogosClient";

export default async function CatalogosPage() {
  const session = await auth();
  const rol = session!.user.rol as Rol;
  const permisos = parsePermisos(session!.user.permisos, rol);
  if (!permisos.catalogos) redirect("/dashboard");

  const lista = await db.select().from(catalogoInsumos).orderBy(asc(catalogoInsumos.codigo_igss));
  const canEdit = rol === "superadmin" || rol === "admin";

  return <CatalogosClient insumos={lista} canEdit={canEdit} />;
}
