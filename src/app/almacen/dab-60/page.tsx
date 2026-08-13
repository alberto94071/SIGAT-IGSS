import { getOrdenesEnDab, getOrdenesDab60PendienteAprobacion, getPagosFondoRotativoEnDab60 } from "@/lib/adjudicacion/dab60-actions";
import Dab60Client from "./Dab60Client";

export default async function Dab60Page() {
  const [ordenes, pendientesAprobacion, pagosFondoRotativo] = await Promise.all([
    getOrdenesEnDab(),
    getOrdenesDab60PendienteAprobacion(),
    getPagosFondoRotativoEnDab60(),
  ]);
  return <Dab60Client ordenes={ordenes} pendientesAprobacion={pendientesAprobacion} pagosFondoRotativo={pagosFondoRotativo} />;
}
