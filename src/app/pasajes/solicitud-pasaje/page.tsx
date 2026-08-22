import { requireTabAccess } from "@/lib/modulo-access";
import { listarSolicitudesPasaje, listarDelegaciones } from "@/lib/pasajes-actions";
import SolicitudPasajeClient from "./SolicitudPasajeClient";

export default async function SolicitudPasajePage() {
  const { rol } = await requireTabAccess("mod_pasajes", "tab_pasajes_solicitud");
  const canEdit = rol !== "consulta";

  const [solicitudes, delegaciones] = await Promise.all([
    listarSolicitudesPasaje(),
    listarDelegaciones(),
  ]);

  return <SolicitudPasajeClient solicitudes={solicitudes} delegaciones={delegaciones} canEdit={canEdit} />;
}
