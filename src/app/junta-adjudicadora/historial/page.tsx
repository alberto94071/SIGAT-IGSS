import { requireTabAccess } from "@/lib/modulo-access";
import { getActasHistorial } from "@/lib/adjudicacion/actas-adjudicacion-actions";
import HistorialClient from "./HistorialClient";

export default async function HistorialPage() {
  await requireTabAccess("mod_junta_adjudicadora", "tab_junta_historial");
  const rows = await getActasHistorial();
  return <HistorialClient rows={rows} />;
}
