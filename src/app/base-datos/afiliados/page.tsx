import { contarAfiliados } from "@/lib/afiliados-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import AfiliadosClient from "./AfiliadosClient";

export default async function AfiliadosPage() {
  await requireTabAccess("mod_base_datos", "tab_basedatos_afiliados");
  const total = await contarAfiliados();
  return <AfiliadosClient total={total} />;
}
