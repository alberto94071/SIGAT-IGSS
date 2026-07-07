import { Coins } from "lucide-react";
import { getLibroCajaChica } from "@/lib/caja-chica-liquidacion-actions";
import LibroFondoRotativoTable from "@/components/adjudicacion/LibroFondoRotativoTable";

export default async function CajaChicaLibroCajaChicaPage() {
  const pagos = await getLibroCajaChica();
  return (
    <LibroFondoRotativoTable
      pagos={pagos}
      titulo="Libro Caja Chica"
      icon={Coins}
      mensajeVacio="No hay vales liquidados todavía."
      tipo="caja_chica"
    />
  );
}
