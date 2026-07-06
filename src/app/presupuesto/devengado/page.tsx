import { getOrdenesEnDevengado } from "@/lib/adjudicacion/devengado-actions";
import DevengadoClient from "./DevengadoClient";

export default async function DevengadoPage() {
  const ordenes = await getOrdenesEnDevengado();
  return <DevengadoClient ordenes={ordenes} />;
}
