import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { getConsolidacionesConDetalles } from "@/lib/adjudicacion/actions";
import ComprasAdjudicacionClient from "@/components/adjudicacion/ComprasAdjudicacionClient";

export default async function AdjudicacionPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const consolidaciones = await getConsolidacionesConDetalles();
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";
  return <ComprasAdjudicacionClient consolidaciones={consolidaciones} canEdit={canEdit} />;
}
