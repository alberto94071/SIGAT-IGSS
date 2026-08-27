import { requireTabAccess } from "@/lib/modulo-access";
import { getCatalogoAlmacen } from "./actions";
import CatalogoAlmacenClient from "./CatalogoAlmacenClient";

export default async function AlmacenCatalogoPage() {
  const { rol } = await requireTabAccess("mod_almacen", "tab_almacen_catalogo");
  const canEdit = rol !== "consulta";
  const insumos = await getCatalogoAlmacen();
  return <CatalogoAlmacenClient insumos={insumos} canEdit={canEdit} />;
}
