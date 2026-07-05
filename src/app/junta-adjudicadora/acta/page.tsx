import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { getActasPendientes } from "@/lib/adjudicacion/actas-adjudicacion-actions";
import ActaClient from "./ActaClient";

export default async function ActaPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const rows = await getActasPendientes();
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";
  return <ActaClient rows={rows as any} canEdit={canEdit} />;
}
