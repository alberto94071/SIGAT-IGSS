import { getOrdenesArchivadasAlmacen, getPagosFondoRotativoArchivados } from "@/lib/adjudicacion/dab60-actions";
import { getRequisiciones } from "@/app/almacen/dab-75/actions";
import ArchivoClient from "./ArchivoClient";

export default async function AlmacenArchivoPage() {
  const [{ ordenes, hasMore }, { pagos, hasMore: hasMoreFr }, requisiciones] = await Promise.all([
    getOrdenesArchivadasAlmacen(0),
    getPagosFondoRotativoArchivados(0),
    getRequisiciones(),
  ]);
  return (
    <ArchivoClient
      ordenes={ordenes} hasMore={hasMore}
      pagosFr={pagos} hasMoreFr={hasMoreFr}
      requisiciones={requisiciones}
    />
  );
}
