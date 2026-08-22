import { requireTabAccess } from "@/lib/modulo-access";
import { getConsolidacionesConDetalles } from "@/lib/adjudicacion/actions";
import JuntaAdjudicacionClient from "@/components/adjudicacion/JuntaAdjudicacionClient";

export default async function JuntaAdjudicacionPage() {
  const { rol } = await requireTabAccess("mod_junta_adjudicadora", "tab_junta_adjudicacion");
  const consolidaciones = (await getConsolidacionesConDetalles())
    .filter(c => c.estado === "Enviado a Junta");
  const canEdit = rol !== "consulta";
  return <JuntaAdjudicacionClient consolidaciones={consolidaciones} canEdit={canEdit} />;
}
