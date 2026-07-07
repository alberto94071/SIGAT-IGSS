import { Coins } from "lucide-react";
import { getLibroCajaChica } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import LibroFondoRotativoTable from "@/components/adjudicacion/LibroFondoRotativoTable";

export default async function LibroCajaChicaPage() {
  const pagos = await getLibroCajaChica();
  return (
    <LibroFondoRotativoTable
      pagos={pagos}
      titulo="Fondo Rotativo — Libro Caja Chica"
      icon={Coins}
      mensajeVacio="No hay pagos en efectivo enviados al Libro de Caja Chica todavía."
      tipo="caja_chica"
    />
  );
}
