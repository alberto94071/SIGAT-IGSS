import { requireTabAccess } from "@/lib/modulo-access";
import { getRecepciones } from "./actions";
import LibrosClient from "./LibrosClient";

export default async function ViaticosLibrosPage() {
  await requireTabAccess("mod_viaticos", "tab_viaticos_libros");
  const recepciones = await getRecepciones();
  return <LibrosClient recepciones={recepciones} />;
}
