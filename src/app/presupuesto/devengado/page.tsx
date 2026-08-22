import { getOrdenesEnDevengado, getOrdenesDevengadoSolicitado, getOrdenesEnviadasADaf } from "@/lib/adjudicacion/devengado-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import DevengadoClient from "./DevengadoClient";

export default async function DevengadoPage() {
  await requireTabAccess("mod_presupuesto", "tab_presupuesto_devengado");
  const [ordenes, solicitadas, enviadas] = await Promise.all([
    getOrdenesEnDevengado(),
    getOrdenesDevengadoSolicitado(),
    getOrdenesEnviadasADaf(),
  ]);
  return <DevengadoClient ordenes={ordenes} solicitadas={solicitadas} enviadas={enviadas} />;
}
