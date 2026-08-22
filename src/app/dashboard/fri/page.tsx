import { getPagosPendientesFri, getPolizasPendientesFri, getFrisConformados } from "@/lib/fri-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import FriClient from "./FriClient";

export default async function FriPage() {
  await requireTabAccess("mod_fondo_rotativo", "tab_fr_fri");
  const [pendientesPagos, pendientesPolizas, fris] = await Promise.all([
    getPagosPendientesFri(),
    getPolizasPendientesFri(),
    getFrisConformados(),
  ]);
  return <FriClient pendientesPagos={pendientesPagos} pendientesPolizas={pendientesPolizas} fris={fris} />;
}
