import { getPagosPendientesFormaPago } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import PagosClient from "./PagosClient";

export default async function PagosPage() {
  const pagos = await getPagosPendientesFormaPago();
  return <PagosClient pagos={pagos} />;
}
