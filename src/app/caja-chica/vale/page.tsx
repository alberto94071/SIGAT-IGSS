import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { getVales } from "@/lib/vale-actions";
import ValeClient from "./ValeClient";

export default async function CajaChicaValePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";
  const vales = await getVales();
  return <ValeClient vales={vales} canEdit={canEdit} />;
}
