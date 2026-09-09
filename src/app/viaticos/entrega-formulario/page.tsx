import { requireTabAccess } from "@/lib/modulo-access";
import { getSolicitudesArchivo } from "../registro-comision/actions";
import EntregaFormularioClient from "./EntregaFormularioClient";

export default async function EntregaFormularioPage() {
  const { rol } = await requireTabAccess("mod_viaticos", "tab_viaticos_entrega");
  const canEdit = rol !== "consulta";
  const solicitudes = await getSolicitudesArchivo();
  return <EntregaFormularioClient solicitudes={solicitudes} canEdit={canEdit} />;
}
