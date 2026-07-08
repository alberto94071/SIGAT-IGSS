import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { listarTarifario } from "@/lib/pasajes-actions";
import TarifarioClient from "./TarifarioClient";

export default async function TarifarioPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";

  const tarifario = await listarTarifario();

  return <TarifarioClient tarifario={tarifario} canEdit={canEdit} />;
}
