import { getOrdenesEnDevengado, getOrdenesEnviadasADaf } from "@/lib/adjudicacion/devengado-actions";
import DevengadoClient from "./DevengadoClient";

export default async function DevengadoPage() {
  const [ordenes, enviadas] = await Promise.all([
    getOrdenesEnDevengado(),
    getOrdenesEnviadasADaf(),
  ]);
  return <DevengadoClient ordenes={ordenes} enviadas={enviadas} />;
}
