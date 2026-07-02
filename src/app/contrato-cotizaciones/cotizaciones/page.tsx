import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { listarCotizacionesServicio } from "@/lib/adjudicacion/cotizaciones-actions";
import CotizacionesClient from "./CotizacionesClient";

export default async function CotizacionesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const cotizaciones = await listarCotizacionesServicio();
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";
  return <CotizacionesClient cotizaciones={cotizaciones as any} canEdit={canEdit} />;
}
