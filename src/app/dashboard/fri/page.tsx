import { getPagosPendientesFri, getPolizasPendientesFri, getViaticosPendientesFri, getFrisConformados } from "@/lib/fri-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import FriClient from "./FriClient";

export default async function FriPage() {
  await requireTabAccess("mod_fondo_rotativo", "tab_fr_fri");
  const [pendientesPagos, pendientesPolizas, pendientesViaticos, fris] = await Promise.all([
    getPagosPendientesFri(),
    getPolizasPendientesFri(),
    getViaticosPendientesFri(),
    getFrisConformados(),
  ]);
  return <FriClient pendientesPagos={pendientesPagos} pendientesPolizas={pendientesPolizas} pendientesViaticos={pendientesViaticos} fris={fris} />;
}
