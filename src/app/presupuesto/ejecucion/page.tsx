import { requireTabAccess } from "@/lib/modulo-access";
import { getEjecucionData } from "@/lib/ejecucion-actions";
import EjecucionClient from "./EjecucionClient";

export default async function EjecucionPage() {
  await requireTabAccess("mod_presupuesto", "tab_presupuesto_ejecucion");
  const data = await getEjecucionData();
  return <EjecucionClient data={data} />;
}
