import { getConsolidacionesConDetalles } from "./actions";
import AdjudicacionClient from "./AdjudicacionClient";

export default async function AdjudicacionPage() {
  const consolidaciones = await getConsolidacionesConDetalles();
  return <AdjudicacionClient consolidaciones={consolidaciones} />;
}
