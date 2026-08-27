import { requireTabAccess } from "@/lib/modulo-access";
import { getSolicitudesAlmacen } from "./actions";
import Dab75Client from "./Dab75Client";

export default async function Dab75Page() {
  const { rol } = await requireTabAccess("mod_almacen", "tab_almacen_dab75");
  const canEdit = rol !== "consulta";
  const solicitudes = await getSolicitudesAlmacen();
  return <Dab75Client solicitudes={solicitudes} canEdit={canEdit} />;
}
