import { getLibroBancos } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import BancosClient from "./BancosClient";

export default async function BancosPage() {
  await requireTabAccess("mod_fondo_rotativo", "tab_fr_bancos");
  const pagos = await getLibroBancos();
  return <BancosClient pagos={pagos} />;
}
