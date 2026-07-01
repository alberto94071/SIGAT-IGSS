import { db } from "@/lib/db";
import { catalogoCompras } from "@/lib/schema";
import { asc } from "drizzle-orm";
import CatalogoPacClient from "./CatalogoPacClient";

export default async function CatalogoPacPage() {
  const items = await db.select({
    id:              catalogoCompras.id,
    codigo_ppr:      catalogoCompras.codigo_ppr,
    codigo_rango:    catalogoCompras.codigo_rango,
    nombre:          catalogoCompras.nombre,
    caracteristicas: catalogoCompras.caracteristicas,
    presentacion:    catalogoCompras.presentacion,
    subproducto:     catalogoCompras.subproducto,
    cantidad:        catalogoCompras.cantidad,
  }).from(catalogoCompras).orderBy(asc(catalogoCompras.nombre));

  return <CatalogoPacClient items={items} />;
}
