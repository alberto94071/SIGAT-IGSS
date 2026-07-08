import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { listarSolicitudesPasaje, listarTarifario } from "@/lib/pasajes-actions";
import SolicitudPasajeClient from "./SolicitudPasajeClient";

export default async function SolicitudPasajePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";

  const [solicitudes, tarifario] = await Promise.all([
    listarSolicitudesPasaje(),
    listarTarifario(),
  ]);

  return <SolicitudPasajeClient solicitudes={solicitudes} tarifario={tarifario} canEdit={canEdit} />;
}
