import { db } from "@/lib/db";
import { proveedores } from "@/lib/schema";
import { requireTabAccess } from "@/lib/modulo-access";
import ProveedoresClient from "./ProveedoresClient";

export default async function ProveedoresPage() {
  await requireTabAccess("mod_base_datos", "tab_basedatos_proveedores");
  const lista = await db
    .select()
    .from(proveedores)
    .orderBy(proveedores.nombre);

  return <ProveedoresClient lista={lista} />;
}
