import { getLibroBancos } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import BancosClient from "./BancosClient";

export default async function BancosPage() {
  const pagos = await getLibroBancos();
  return <BancosClient pagos={pagos} />;
}
