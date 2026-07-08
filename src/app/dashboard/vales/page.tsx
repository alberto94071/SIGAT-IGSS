import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { getValesPendientesAutorizacion, getSaldoFondoRotativo, getVales } from "@/lib/vale-actions";
import ValesClient from "./ValesClient";

export default async function FondoRotativoValesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";

  const [pendientes, saldo, todos] = await Promise.all([
    getValesPendientesAutorizacion(),
    getSaldoFondoRotativo(),
    getVales(),
  ]);

  const autorizados = todos.filter(v => v.estado === "Autorizado");
  const activos = todos.filter(v => v.estado === "Activo");

  return <ValesClient pendientes={pendientes} autorizados={autorizados} activos={activos} saldo={saldo} canEdit={canEdit} />;
}
