import { getPagosPendientesFormaPago } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import PagosClient from "./PagosClient";

export default async function PagosPage() {
  await requireTabAccess("mod_fondo_rotativo", "tab_fr_pagos");
  const pagos = await getPagosPendientesFormaPago();
  return <PagosClient pagos={pagos} />;
}
