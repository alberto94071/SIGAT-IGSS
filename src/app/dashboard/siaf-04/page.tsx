import { getPendientesPorDestino } from "@/lib/adjudicacion/actions";
import BandejaDestino from "@/components/adjudicacion/BandejaDestino";

export default async function Siaf04Page() {
  const consolidaciones = await getPendientesPorDestino("fondo_rotativo");
  return <BandejaDestino consolidaciones={consolidaciones} titulo="Fondo Rotativo — SIAF-04" />;
}
