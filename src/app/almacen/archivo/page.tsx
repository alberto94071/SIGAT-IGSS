import { getOrdenesArchivadasAlmacen } from "@/lib/adjudicacion/dab60-actions";
import ArchivoClient from "./ArchivoClient";

export default async function AlmacenArchivoPage() {
  const { ordenes, hasMore } = await getOrdenesArchivadasAlmacen(0);
  return <ArchivoClient ordenes={ordenes} hasMore={hasMore} />;
}
