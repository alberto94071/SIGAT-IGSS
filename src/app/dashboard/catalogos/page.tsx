import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { catalogoInsumos, catalogoSubproductos } from "@/lib/schema";
import { redirect } from "next/navigation";
import { parsePermisos, type Rol } from "@/lib/permisos";
import { asc } from "drizzle-orm";
import CatalogosClient from "./CatalogosClient";
import SubproductosClient from "./SubproductosClient";

export default async function CatalogosPage() {
  const session = await auth();
  const rol = session!.user.rol as Rol;
  const permisos = parsePermisos(session!.user.permisos, rol);
  if (!permisos.catalogos) redirect("/dashboard");

  const [lista, subprodLista] = await Promise.all([
    db.select().from(catalogoInsumos).orderBy(asc(catalogoInsumos.codigo_igss)),
    db.select().from(catalogoSubproductos).orderBy(asc(catalogoSubproductos.nombre)),
  ]);

  const canEdit      = rol === "superadmin" || rol === "admin";
  const isSuperadmin = rol === "superadmin";

  return (
    <div className="space-y-6">
      <CatalogosClient insumos={lista} canEdit={canEdit} />
      {isSuperadmin && (
        <SubproductosClient subproductos={subprodLista} />
      )}
    </div>
  );
}
