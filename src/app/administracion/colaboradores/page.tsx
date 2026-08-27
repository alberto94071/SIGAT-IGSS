import { requireTabAccess } from "@/lib/modulo-access";
import { getColaboradores } from "./actions";
import ColaboradoresClient from "./ColaboradoresClient";

export default async function ColaboradoresPage() {
  await requireTabAccess("mod_administracion", "tab_admin_usuarios");
  const colaboradores = await getColaboradores();
  return <ColaboradoresClient colaboradores={colaboradores} />;
}
