import { getPendientesPorDestino } from "@/lib/adjudicacion/actions";
import BandejaDestino from "@/components/adjudicacion/BandejaDestino";

export default async function PresupuestoGeneralPage() {
  const consolidaciones = await getPendientesPorDestino("presupuesto");
  return <BandejaDestino consolidaciones={consolidaciones} titulo="Presupuesto — General" />;
}
