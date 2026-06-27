import { db } from "@/lib/db";
import { proveedores } from "@/lib/schema";
import ProveedoresClient from "./ProveedoresClient";

export default async function ProveedoresPage() {
  const lista = await db
    .select()
    .from(proveedores)
    .orderBy(proveedores.nombre);

  return <ProveedoresClient lista={lista} />;
}
