import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { catalogoCompras } from "@/lib/schema";
import { asc } from "drizzle-orm";
import { type Rol } from "@/lib/permisos";
import CatalogoComprasClient from "./CatalogoComprasClient";

export default async function CatalogoComprasPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";

  const lista = await db
    .select()
    .from(catalogoCompras)
    .orderBy(asc(catalogoCompras.nombre));

  return <CatalogoComprasClient insumos={lista as any} canEdit={canEdit} />;
}
