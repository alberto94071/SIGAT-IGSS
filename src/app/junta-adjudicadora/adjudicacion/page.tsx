import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { getConsolidacionesConDetalles } from "@/lib/adjudicacion/actions";
import AdjudicacionClient from "@/components/adjudicacion/AdjudicacionClient";

export default async function JuntaAdjudicacionPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const consolidaciones = await getConsolidacionesConDetalles();
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";
  return <AdjudicacionClient consolidaciones={consolidaciones} rol="junta" canEdit={canEdit} />;
}
