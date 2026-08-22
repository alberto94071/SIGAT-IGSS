import { getLibroConciliacion } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import LibroConciliacionClient from "./LibroConciliacionClient";

export default async function LibroConciliacionPage() {
  await requireTabAccess("mod_fondo_rotativo", "tab_fr_libro_conciliacion");
  const movimientos = await getLibroConciliacion();
  return <LibroConciliacionClient movimientos={movimientos} />;
}
