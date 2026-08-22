import { requireTabAccess } from "@/lib/modulo-access";
import { getLiquidaciones } from "./actions";
import EntregaFormularioClient from "./EntregaFormularioClient";

export default async function EntregaFormularioPage() {
  const { rol } = await requireTabAccess("mod_viaticos", "tab_viaticos_entrega");
  const canEdit = rol !== "consulta";
  const liquidaciones = await getLiquidaciones();
  return <EntregaFormularioClient liquidaciones={liquidaciones} canEdit={canEdit} />;
}
