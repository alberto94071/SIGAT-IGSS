import { requireTabAccess } from "@/lib/modulo-access";
import { getConsolidacionesConDetalles } from "@/lib/adjudicacion/actions";
import ComprasAdjudicacionClient from "@/components/adjudicacion/ComprasAdjudicacionClient";

export default async function AdjudicacionPage() {
  const { rol } = await requireTabAccess("mod_compras", "tab_compras_adjudicacion");
  const todas = await getConsolidacionesConDetalles();
  // Solo lo que Compras puede seguir trabajando — el resto (Adjudicado, Enviado
  // a Junta/Presupuesto/Fondo Rotativo, Orden Generada) ya no tiene ninguna
  // acción posible aquí y queda visible en Compras/Archivo y Hoja de Ruta.
  const consolidaciones = todas.filter(c =>
    c.estado === "Pendiente adjudicación" || c.estado === "Rechazado por Junta"
  );
  const canEdit = rol !== "consulta";
  return <ComprasAdjudicacionClient consolidaciones={consolidaciones} canEdit={canEdit} />;
}
