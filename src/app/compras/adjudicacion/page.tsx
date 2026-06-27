import { getConsolidaciones } from "../a01-siaf/actions";
import AdjudicacionClient from "./AdjudicacionClient";

export default async function AdjudicacionPage() {
  const consolidaciones = await getConsolidaciones();
  return <AdjudicacionClient consolidaciones={consolidaciones} />;
}
