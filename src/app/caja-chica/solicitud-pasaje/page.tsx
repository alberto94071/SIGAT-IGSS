import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { listarPagosPasajes, listarTarifario, getValesParaPasaje } from "@/lib/pasajes-actions";
import SolicitudPasajeClient from "./SolicitudPasajeClient";

export default async function SolicitudPasajePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";

  const [pagos, tarifario, vales] = await Promise.all([
    listarPagosPasajes(),
    listarTarifario(),
    getValesParaPasaje(),
  ]);

  return <SolicitudPasajeClient pagos={pagos} tarifario={tarifario} vales={vales} canEdit={canEdit} />;
}
