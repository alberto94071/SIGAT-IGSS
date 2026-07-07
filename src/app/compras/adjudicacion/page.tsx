import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { getConsolidacionesConDetalles } from "@/lib/adjudicacion/actions";
import ComprasAdjudicacionClient from "@/components/adjudicacion/ComprasAdjudicacionClient";

export default async function AdjudicacionPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const todas = await getConsolidacionesConDetalles();
  // Solo lo que Compras puede seguir trabajando — el resto (Adjudicado, Enviado
  // a Junta/Presupuesto/Fondo Rotativo, Orden Generada) ya no tiene ninguna
  // acción posible aquí y queda visible en Compras/Archivo y Hoja de Ruta.
  const consolidaciones = todas.filter(c =>
    c.estado === "Pendiente adjudicación" || c.estado === "Rechazado por Junta"
  );
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";
  return <ComprasAdjudicacionClient consolidaciones={consolidaciones} canEdit={canEdit} />;
}
