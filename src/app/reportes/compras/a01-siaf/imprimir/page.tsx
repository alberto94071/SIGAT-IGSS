import { requireTabAccess } from "@/lib/modulo-access";
import { getReporteA01SiafCompleto } from "@/lib/reportes/compras-actions";
import ImprimirReporteA01SiafClient from "./ImprimirReporteA01SiafClient";

export default async function ImprimirReporteA01SiafPage() {
  await requireTabAccess("mod_reportes", "tab_reportes_compras_a01siaf");
  const filas = await getReporteA01SiafCompleto();
  return <ImprimirReporteA01SiafClient filas={filas} />;
}
