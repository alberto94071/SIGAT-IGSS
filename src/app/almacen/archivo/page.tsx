import { getOrdenesArchivadasAlmacen } from "@/lib/adjudicacion/dab60-actions";
import ArchivoClient from "./ArchivoClient";

export default async function AlmacenArchivoPage() {
  const ordenes = await getOrdenesArchivadasAlmacen();
  return <ArchivoClient ordenes={ordenes} />;
}
