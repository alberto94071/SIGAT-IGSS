import { getOrdenesEnDab, getOrdenesDab60PendienteAprobacion } from "@/lib/adjudicacion/dab60-actions";
import Dab60Client from "./Dab60Client";

export default async function Dab60Page() {
  const [ordenes, pendientesAprobacion] = await Promise.all([
    getOrdenesEnDab(),
    getOrdenesDab60PendienteAprobacion(),
  ]);
  return <Dab60Client ordenes={ordenes} pendientesAprobacion={pendientesAprobacion} />;
}
