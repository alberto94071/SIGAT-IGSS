import { getLiquidacionesPendientes } from "@/lib/caja-chica-liquidacion-actions";
import LiquidacionClient from "./LiquidacionClient";

export default async function CajaChicaLiquidacionPage() {
  const pagos = await getLiquidacionesPendientes();
  return <LiquidacionClient pagos={pagos} />;
}
