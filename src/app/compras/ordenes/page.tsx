import { getConsolidacionesPendientesOrden, getOrdenesEnProceso } from "@/lib/adjudicacion/ordenes-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import OrdenesClient from "./OrdenesClient";

export default async function OrdenesPage() {
  await requireTabAccess("mod_compras", "tab_compras_ordenes");
  const [pendientes, enProceso] = await Promise.all([
    getConsolidacionesPendientesOrden(),
    getOrdenesEnProceso(),
  ]);
  return <OrdenesClient pendientes={pendientes} enProceso={enProceso} />;
}
