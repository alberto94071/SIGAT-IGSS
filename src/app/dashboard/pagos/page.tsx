import { getPagosPendientesFormaPago } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import { getViaticoPagosPendientesFormaPago } from "@/lib/viatico-pagos-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import PagosClient from "./PagosClient";

export default async function PagosPage() {
  await requireTabAccess("mod_fondo_rotativo", "tab_fr_pagos");
  const [pagos, viaticos] = await Promise.all([
    getPagosPendientesFormaPago(),
    getViaticoPagosPendientesFormaPago(),
  ]);
  return <PagosClient pagos={pagos} viaticos={viaticos} />;
}
