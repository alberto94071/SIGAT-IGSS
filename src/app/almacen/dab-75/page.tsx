import { requireTabAccess } from "@/lib/modulo-access";
import { getRequisiciones } from "./actions";
import Dab75Client from "./Dab75Client";

export default async function Dab75Page() {
  const { rol } = await requireTabAccess("mod_almacen", "tab_almacen_dab75");
  const canEdit = rol !== "consulta";
  const requisiciones = await getRequisiciones();
  return <Dab75Client requisiciones={requisiciones} canEdit={canEdit} />;
}
