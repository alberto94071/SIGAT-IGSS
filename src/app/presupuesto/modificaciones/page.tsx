import { requireModuloAccess } from "@/lib/modulo-access";
import ModificacionesClient from "./ModificacionesClient";

export default async function ModificacionesPage() {
  const { permisos } = await requireModuloAccess("mod_presupuesto");
  return <ModificacionesClient permisos={permisos} />;
}
