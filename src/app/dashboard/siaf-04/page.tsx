import { getPendientesSiaf04 } from "@/lib/adjudicacion/siaf04-actions";
import Siaf04Client from "./Siaf04Client";

export default async function Siaf04Page() {
  const consolidaciones = await getPendientesSiaf04();
  return <Siaf04Client consolidaciones={consolidaciones} />;
}
