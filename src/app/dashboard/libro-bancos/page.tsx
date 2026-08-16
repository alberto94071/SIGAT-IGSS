import { getLibroBancosCompleto } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import LibroBancosClient from "./LibroBancosClient";

export default async function LibroBancosPage() {
  const movimientos = await getLibroBancosCompleto();
  return <LibroBancosClient movimientos={movimientos} />;
}
