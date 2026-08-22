import { getOrdenesEnCompromiso, getOrdenesCompromisoSolicitado, getComprometidosHistorico } from "@/lib/adjudicacion/compromiso-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import CompromisoClient from "./CompromisoClient";

export default async function CompromisoPage() {
  await requireTabAccess("mod_presupuesto", "tab_presupuesto_compromiso");
  const [ordenes, solicitadas, historico] = await Promise.all([
    getOrdenesEnCompromiso(),
    getOrdenesCompromisoSolicitado(),
    getComprometidosHistorico(),
  ]);
  return <CompromisoClient ordenes={ordenes} solicitadas={solicitadas} historico={historico} />;
}
