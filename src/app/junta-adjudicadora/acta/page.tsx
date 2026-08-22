import { requireTabAccess } from "@/lib/modulo-access";
import { getActasPendientes } from "@/lib/adjudicacion/actas-adjudicacion-actions";
import ActaClient from "./ActaClient";

export default async function ActaPage() {
  const { rol } = await requireTabAccess("mod_junta_adjudicadora", "tab_junta_acta");
  const rows = await getActasPendientes();
  const canEdit = rol !== "consulta";
  return <ActaClient rows={rows as any} canEdit={canEdit} />;
}
