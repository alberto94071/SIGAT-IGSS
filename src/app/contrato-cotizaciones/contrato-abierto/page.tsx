import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { listarCotizacionesAnuales } from "@/lib/adjudicacion/cotizaciones-actions";
import ContratoAbiertoClient from "./ContratoAbiertoClient";

export default async function ContratoAbiertoPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const contratos = await listarCotizacionesAnuales(["contrato_abierto"]);
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";

  return <ContratoAbiertoClient contratos={contratos} canEdit={canEdit} />;
}
