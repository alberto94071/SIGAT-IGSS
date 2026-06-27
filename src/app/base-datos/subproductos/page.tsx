import { db } from "@/lib/db";
import { catalogoSubproductos } from "@/lib/schema";
import SubproductosClient from "./SubproductosClient";

export default async function SubproductosPage() {
  const lista = await db
    .select()
    .from(catalogoSubproductos)
    .orderBy(catalogoSubproductos.nombre);

  return <SubproductosClient lista={lista} />;
}
