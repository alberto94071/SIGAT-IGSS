import { getEjecucionData } from "@/lib/ejecucion-actions";
import EjecucionClient from "./EjecucionClient";

export default async function EjecucionPage() {
  const data = await getEjecucionData();
  return <EjecucionClient data={data} />;
}
