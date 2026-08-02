import { getOrdenesEnCompromiso, getOrdenesCompromisoSolicitado } from "@/lib/adjudicacion/compromiso-actions";
import CompromisoClient from "./CompromisoClient";

export default async function CompromisoPage() {
  const [ordenes, solicitadas] = await Promise.all([
    getOrdenesEnCompromiso(),
    getOrdenesCompromisoSolicitado(),
  ]);
  return <CompromisoClient ordenes={ordenes} solicitadas={solicitadas} />;
}
