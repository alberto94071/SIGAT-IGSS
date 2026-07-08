import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { listarSolicitudesPendientes, listarPagosPasajes, getValesParaPasaje } from "@/lib/pasajes-actions";
import Dpd23BandejaClient from "./Dpd23BandejaClient";

export default async function Dpd23ListaPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";

  const [pendientes, pagos, vales] = await Promise.all([
    listarSolicitudesPendientes(),
    listarPagosPasajes(),
    getValesParaPasaje(),
  ]);

  return <Dpd23BandejaClient pendientes={pendientes} pagos={pagos} vales={vales} canEdit={canEdit} />;
}
