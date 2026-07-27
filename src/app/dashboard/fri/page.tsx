import { getPagosPendientesFri, getPolizasPendientesFri, getFrisConformados } from "@/lib/fri-actions";
import FriClient from "./FriClient";

export default async function FriPage() {
  const [pendientesPagos, pendientesPolizas, fris] = await Promise.all([
    getPagosPendientesFri(),
    getPolizasPendientesFri(),
    getFrisConformados(),
  ]);
  return <FriClient pendientesPagos={pendientesPagos} pendientesPolizas={pendientesPolizas} fris={fris} />;
}
