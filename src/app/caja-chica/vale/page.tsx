import { requireTabAccess } from "@/lib/modulo-access";
import { getVales, getEfectivoEnCaja } from "@/lib/vale-actions";
import ValeClient from "./ValeClient";

export default async function CajaChicaValePage() {
  const { rol } = await requireTabAccess("mod_caja_chica", "tab_cajachica_vale");
  const canEdit = rol !== "consulta";
  const [vales, efectivoEnCaja] = await Promise.all([getVales(), getEfectivoEnCaja()]);
  return <ValeClient vales={vales} efectivoEnCaja={efectivoEnCaja} canEdit={canEdit} />;
}
