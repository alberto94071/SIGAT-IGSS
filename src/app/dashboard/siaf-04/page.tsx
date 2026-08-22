import { getPendientesSiaf04 } from "@/lib/adjudicacion/siaf04-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import Siaf04Client from "./Siaf04Client";

export default async function Siaf04Page() {
  await requireTabAccess("mod_fondo_rotativo", "tab_fr_siaf04");
  const consolidaciones = await getPendientesSiaf04();
  return <Siaf04Client consolidaciones={consolidaciones} />;
}
