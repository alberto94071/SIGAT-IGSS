import { requireTabAccess } from "@/lib/modulo-access";
import { getSolicitudesPendientesHabilitar, getSolicitudesEnviadas } from "./actions";
import RegistroComisionClient from "./RegistroComisionClient";

export default async function RegistroComisionPage() {
  const { rol } = await requireTabAccess("mod_viaticos", "tab_viaticos_comision");
  const canEdit = rol !== "consulta";
  const [pendientes, enviadas] = await Promise.all([
    getSolicitudesPendientesHabilitar(),
    getSolicitudesEnviadas(),
  ]);
  return <RegistroComisionClient pendientes={pendientes} enviadas={enviadas} canEdit={canEdit} />;
}
