import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { catalogoCompras } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import CatalogoComprasClient from "./CatalogoComprasClient";

export default async function CatalogoComprasPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const lista = await db
    .select({
      id:                      catalogoCompras.id,
      codigo_igss:             catalogoCompras.codigo_igss,
      nombre:                  catalogoCompras.nombre,
      renglon:                 catalogoCompras.renglon,
      subproducto:             catalogoCompras.subproducto,
      cantidad:                catalogoCompras.cantidad,
      precio_estimado:         catalogoCompras.precio_estimado,
      monto:                   catalogoCompras.monto,
    })
    .from(catalogoCompras)
    .where(eq(catalogoCompras.activo, true))
    .orderBy(asc(catalogoCompras.nombre));

  return <CatalogoComprasClient insumos={lista} />;
}
