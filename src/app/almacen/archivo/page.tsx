import { getOrdenesArchivadasAlmacen, getPagosFondoRotativoArchivados } from "@/lib/adjudicacion/dab60-actions";
import { getRequisiciones, getInsumosParaHistorial } from "@/app/almacen/dab-75/actions";
import { requireTabAccess } from "@/lib/modulo-access";
import ArchivoClient from "./ArchivoClient";

export default async function AlmacenArchivoPage() {
  await requireTabAccess("mod_almacen", "tab_almacen_archivo");
  const [{ ordenes, hasMore }, { pagos, hasMore: hasMoreFr }, requisiciones, insumos] = await Promise.all([
    getOrdenesArchivadasAlmacen(0),
    getPagosFondoRotativoArchivados(0),
    getRequisiciones(),
    getInsumosParaHistorial(),
  ]);
  return (
    <ArchivoClient
      ordenes={ordenes} hasMore={hasMore}
      pagosFr={pagos} hasMoreFr={hasMoreFr}
      requisiciones={requisiciones}
      insumos={insumos}
    />
  );
}
