import { getOrdenesEnCompromiso, getOrdenesCompromisoSolicitado, getComprometidosHistorico } from "@/lib/adjudicacion/compromiso-actions";
import CompromisoClient from "./CompromisoClient";

export default async function CompromisoPage() {
  const [ordenes, solicitadas, historico] = await Promise.all([
    getOrdenesEnCompromiso(),
    getOrdenesCompromisoSolicitado(),
    getComprometidosHistorico(),
  ]);
  return <CompromisoClient ordenes={ordenes} solicitadas={solicitadas} historico={historico} />;
}
