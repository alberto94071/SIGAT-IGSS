import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { getLiquidaciones } from "./actions";
import EntregaFormularioClient from "./EntregaFormularioClient";

export default async function EntregaFormularioPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";
  const liquidaciones = await getLiquidaciones();
  return <EntregaFormularioClient liquidaciones={liquidaciones} canEdit={canEdit} />;
}
