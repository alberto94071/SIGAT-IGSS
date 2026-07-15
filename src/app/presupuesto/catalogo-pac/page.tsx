import { db } from "@/lib/db";
import { catalogoCompras } from "@/lib/schema";
import { asc } from "drizzle-orm";
import CatalogoPacClient from "./CatalogoPacClient";

export default async function CatalogoPacPage() {
  const items = await db.select({
    id:              catalogoCompras.id,
    codigo_igss:       catalogoCompras.codigo_igss,
    nombre:            catalogoCompras.nombre,
    subproducto:       catalogoCompras.subproducto,
    cantidad:        catalogoCompras.cantidad,
  }).from(catalogoCompras).orderBy(asc(catalogoCompras.nombre));

  return <CatalogoPacClient items={items} />;
}
