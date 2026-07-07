import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { getRequisiciones } from "./actions";
import Dab75Client from "./Dab75Client";

export default async function Dab75Page() {
  const session = await auth();
  if (!session) redirect("/login");
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";
  const requisiciones = await getRequisiciones();
  return <Dab75Client requisiciones={requisiciones} canEdit={canEdit} />;
}
