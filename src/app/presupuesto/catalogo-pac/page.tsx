import { db } from "@/lib/db";
import { catalogoCompras } from "@/lib/schema";
import { asc } from "drizzle-orm";
import CatalogoPacClient from "./CatalogoPacClient";

export default async function CatalogoPacPage() {
  const items = await db.select({
    id:              catalogoCompras.id,
    codigo_nombre_ppr: catalogoCompras.codigo_nombre_ppr,
    codigo_igss:       catalogoCompras.codigo_igss,
    nombre:            catalogoCompras.nombre,
    unidad_medida:     catalogoCompras.unidad_medida,
    subproducto:       catalogoCompras.subproducto,
    cantidad:        catalogoCompras.cantidad,
  }).from(catalogoCompras).orderBy(asc(catalogoCompras.nombre));

  return <CatalogoPacClient items={items} />;
}
