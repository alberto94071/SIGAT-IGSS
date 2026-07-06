import { getConsolidacionesPendientesOrden, getOrdenesEnProceso } from "@/lib/adjudicacion/ordenes-actions";
import OrdenesClient from "./OrdenesClient";

export default async function OrdenesPage() {
  const [pendientes, enProceso] = await Promise.all([
    getConsolidacionesPendientesOrden(),
    getOrdenesEnProceso(),
  ]);
  return <OrdenesClient pendientes={pendientes} enProceso={enProceso} />;
}
