import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { getVales, getEfectivoEnCaja } from "@/lib/vale-actions";
import ValeClient from "./ValeClient";

export default async function CajaChicaValePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";
  const [vales, efectivoEnCaja] = await Promise.all([getVales(), getEfectivoEnCaja()]);
  return <ValeClient vales={vales} efectivoEnCaja={efectivoEnCaja} canEdit={canEdit} />;
}
