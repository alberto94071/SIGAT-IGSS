import { getArchivoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import ArchivoFondoRotativoClient from "./ArchivoFondoRotativoClient";

export default async function ArchivoFondoRotativoPage() {
  const pagos = await getArchivoFondoRotativo();
  return <ArchivoFondoRotativoClient pagos={pagos} />;
}
