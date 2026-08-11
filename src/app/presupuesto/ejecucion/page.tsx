import { requireModuloAccess } from "@/lib/modulo-access";
import { getEjecucionData } from "@/lib/ejecucion-actions";
import EjecucionClient from "./EjecucionClient";

export default async function EjecucionPage() {
  await requireModuloAccess("mod_presupuesto");
  const data = await getEjecucionData();
  return <EjecucionClient data={data} />;
}
