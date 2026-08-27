import { requireTabAccess } from "@/lib/modulo-access";
import { getRequisiciones, getInsumosConExistencia } from "./actions";
import Dab75Client from "./Dab75Client";

export default async function Dab75Page() {
  const { rol } = await requireTabAccess("mod_almacen", "tab_almacen_dab75");
  const canEdit = rol !== "consulta";
  const [requisiciones, insumos] = await Promise.all([getRequisiciones(), getInsumosConExistencia()]);
  return <Dab75Client requisiciones={requisiciones} insumos={insumos} canEdit={canEdit} />;
}
