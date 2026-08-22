import { requireTabAccess } from "@/lib/modulo-access";
import { getValesPendientesAutorizacion, getSaldoFondoRotativo, getVales } from "@/lib/vale-actions";
import ValesClient from "./ValesClient";

export default async function FondoRotativoValesPage() {
  const { rol } = await requireTabAccess("mod_fondo_rotativo", "tab_fr_vales");
  const canEdit = rol !== "consulta";

  const [pendientes, saldo, todos] = await Promise.all([
    getValesPendientesAutorizacion(),
    getSaldoFondoRotativo(),
    getVales(),
  ]);

  const autorizados = todos.filter(v => v.estado === "Autorizado");
  const activos = todos.filter(v => v.estado === "Activo");

  return <ValesClient pendientes={pendientes} autorizados={autorizados} activos={activos} saldo={saldo} canEdit={canEdit} />;
}
