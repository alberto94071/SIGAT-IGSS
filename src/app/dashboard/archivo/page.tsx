import { getArchivoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import { requireTabAccess } from "@/lib/modulo-access";
import ArchivoFondoRotativoClient from "./ArchivoFondoRotativoClient";

export default async function ArchivoFondoRotativoPage() {
  await requireTabAccess("mod_fondo_rotativo", "tab_fr_archivo");
  const { pagos, hasMore } = await getArchivoFondoRotativo(0);
  return <ArchivoFondoRotativoClient pagos={pagos} hasMore={hasMore} />;
}
