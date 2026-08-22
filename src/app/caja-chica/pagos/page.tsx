import { getLiquidacionesPendientes } from "@/lib/caja-chica-liquidacion-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import PagosCajaChicaClient from "./PagosCajaChicaClient";

export default async function CajaChicaPagosPage() {
  await requireTabAccess("mod_caja_chica", "tab_cajachica_pagos");
  const pagos = await getLiquidacionesPendientes();
  return <PagosCajaChicaClient pagos={pagos} />;
}
