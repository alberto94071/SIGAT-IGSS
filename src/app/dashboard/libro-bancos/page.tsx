import { getLibroBancosCompleto } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import LibroBancosClient from "./LibroBancosClient";

export default async function LibroBancosPage() {
  await requireTabAccess("mod_fondo_rotativo", "tab_fr_libro_bancos");
  const movimientos = await getLibroBancosCompleto();
  return <LibroBancosClient movimientos={movimientos} />;
}
