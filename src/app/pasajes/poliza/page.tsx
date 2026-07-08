import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { listarDpd23SinPoliza, listarPolizas } from "@/lib/poliza-actions";
import { getValeActivo } from "@/lib/vale-actions";
import PolizaClient from "./PolizaClient";

export default async function PolizaPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";

  const [dpd23SinPoliza, polizas, valeActivo] = await Promise.all([
    listarDpd23SinPoliza(),
    listarPolizas(),
    getValeActivo("pasajes"),
  ]);

  return (
    <PolizaClient
      dpd23SinPoliza={dpd23SinPoliza}
      polizas={polizas}
      valeActivo={valeActivo}
      canEdit={canEdit}
    />
  );
}
