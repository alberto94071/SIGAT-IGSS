import { Landmark } from "lucide-react";
import { getLibroBancos } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import LibroFondoRotativoTable from "@/components/adjudicacion/LibroFondoRotativoTable";

export default async function BancosPage() {
  const pagos = await getLibroBancos();
  return (
    <LibroFondoRotativoTable
      pagos={pagos}
      titulo="Fondo Rotativo — Bancos"
      icon={Landmark}
      mensajeVacio="No hay pagos con cheque enviados a Bancos todavía."
      tipo="bancos"
    />
  );
}
