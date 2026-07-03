import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { listarNogs } from "@/lib/nog-actions";
import NogClient from "./NogClient";

export default async function NogPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const nogs = await listarNogs();
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";
  return <NogClient nogs={nogs as any} canEdit={canEdit} />;
}
