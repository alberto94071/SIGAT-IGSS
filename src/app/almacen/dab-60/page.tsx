import { getOrdenesEnDab, getOrdenesDab60PendienteAprobacion, getPagosFondoRotativoEnDab60 } from "@/lib/adjudicacion/dab60-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import Dab60Client from "./Dab60Client";

export default async function Dab60Page() {
  await requireTabAccess("mod_almacen", "tab_almacen_dab60");
  const [ordenes, pendientesAprobacion, pagosFondoRotativo] = await Promise.all([
    getOrdenesEnDab(),
    getOrdenesDab60PendienteAprobacion(),
    getPagosFondoRotativoEnDab60(),
  ]);
  return <Dab60Client ordenes={ordenes} pendientesAprobacion={pendientesAprobacion} pagosFondoRotativo={pagosFondoRotativo} />;
}
