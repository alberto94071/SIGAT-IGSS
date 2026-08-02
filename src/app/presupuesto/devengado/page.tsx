import { getOrdenesEnDevengado, getOrdenesDevengadoSolicitado, getOrdenesEnviadasADaf } from "@/lib/adjudicacion/devengado-actions";
import DevengadoClient from "./DevengadoClient";

export default async function DevengadoPage() {
  const [ordenes, solicitadas, enviadas] = await Promise.all([
    getOrdenesEnDevengado(),
    getOrdenesDevengadoSolicitado(),
    getOrdenesEnviadasADaf(),
  ]);
  return <DevengadoClient ordenes={ordenes} solicitadas={solicitadas} enviadas={enviadas} />;
}
