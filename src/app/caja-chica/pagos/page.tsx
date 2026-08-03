import { getLiquidacionesPendientes } from "@/lib/caja-chica-liquidacion-actions";
import PagosCajaChicaClient from "./PagosCajaChicaClient";

export default async function CajaChicaPagosPage() {
  const pagos = await getLiquidacionesPendientes();
  return <PagosCajaChicaClient pagos={pagos} />;
}
