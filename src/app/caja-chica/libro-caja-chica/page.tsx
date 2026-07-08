import { getLibroCajaChicaCompleto } from "@/lib/caja-chica-liquidacion-actions";
import LibroCajaChicaTable from "@/components/adjudicacion/LibroCajaChicaTable";

export default async function CajaChicaLibroCajaChicaPage() {
  const filas = await getLibroCajaChicaCompleto();
  return <LibroCajaChicaTable filas={filas} />;
}
