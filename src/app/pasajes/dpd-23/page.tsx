import { requireTabAccess } from "@/lib/modulo-access";
import { listarSolicitudesPendientes, listarPagosPasajes } from "@/lib/pasajes-actions";
import Dpd23BandejaClient from "./Dpd23BandejaClient";

export default async function Dpd23ListaPage() {
  const { rol } = await requireTabAccess("mod_pasajes", "tab_pasajes_dpd23");
  const canEdit = rol !== "consulta";

  const [pendientes, pagos] = await Promise.all([
    listarSolicitudesPendientes(),
    listarPagosPasajes(),
  ]);

  return <Dpd23BandejaClient pendientes={pendientes} pagos={pagos} canEdit={canEdit} />;
}
