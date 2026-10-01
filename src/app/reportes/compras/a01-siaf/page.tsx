import { requireTabAccess } from "@/lib/modulo-access";
import { getReporteA01SiafCompleto } from "@/lib/reportes/compras-actions";
import ReporteA01SiafClient from "./ReporteA01SiafClient";

export default async function ReporteA01SiafPage() {
  await requireTabAccess("mod_reportes", "tab_reportes_compras_a01siaf");
  const filas = await getReporteA01SiafCompleto();
  return <ReporteA01SiafClient filas={filas} />;
}
