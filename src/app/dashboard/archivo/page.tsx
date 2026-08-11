import { getArchivoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import ArchivoFondoRotativoClient from "./ArchivoFondoRotativoClient";

export default async function ArchivoFondoRotativoPage() {
  const { pagos, hasMore } = await getArchivoFondoRotativo(0);
  return <ArchivoFondoRotativoClient pagos={pagos} hasMore={hasMore} />;
}
