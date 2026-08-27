import { requireColaborador } from "@/lib/modulo-access";
import { getCatalogoAlmacen } from "@/app/almacen/catalogo/actions";
import SolicitarCatalogoClient from "./SolicitarCatalogoClient";

export default async function SolicitarInsumosCatalogoPage() {
  await requireColaborador();
  const insumos = await getCatalogoAlmacen();
  return <SolicitarCatalogoClient insumos={insumos} />;
}
