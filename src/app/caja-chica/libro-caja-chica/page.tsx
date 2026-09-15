import { getLibroCajaChicaLedger } from "@/lib/caja-chica-liquidacion-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import LibroCajaChicaTable from "@/components/adjudicacion/LibroCajaChicaTable";

export default async function CajaChicaLibroCajaChicaPage() {
  await requireTabAccess("mod_caja_chica", "tab_cajachica_libro");
  const movimientos = await getLibroCajaChicaLedger();
  return <LibroCajaChicaTable movimientos={movimientos} />;
}
