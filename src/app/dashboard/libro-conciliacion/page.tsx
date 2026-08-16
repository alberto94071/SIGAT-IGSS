import { getLibroConciliacion } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import LibroConciliacionClient from "./LibroConciliacionClient";

export default async function LibroConciliacionPage() {
  const movimientos = await getLibroConciliacion();
  return <LibroConciliacionClient movimientos={movimientos} />;
}
