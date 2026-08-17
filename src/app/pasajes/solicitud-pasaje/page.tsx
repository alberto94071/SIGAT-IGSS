import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { listarSolicitudesPasaje, listarDelegaciones } from "@/lib/pasajes-actions";
import SolicitudPasajeClient from "./SolicitudPasajeClient";

export default async function SolicitudPasajePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";

  const [solicitudes, delegaciones] = await Promise.all([
    listarSolicitudesPasaje(),
    listarDelegaciones(),
  ]);

  return <SolicitudPasajeClient solicitudes={solicitudes} delegaciones={delegaciones} canEdit={canEdit} />;
}
