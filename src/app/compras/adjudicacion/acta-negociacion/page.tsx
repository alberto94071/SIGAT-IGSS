import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { getActaNegociacion } from "@/lib/adjudicacion/actas-actions";
import ActaNegociacionClient from "./ActaNegociacionClient";

interface Props { searchParams: Promise<{ anio?: string }> }

export default async function ActaNegociacionPage({ searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { anio: anioParam } = await searchParams;
  const anio = anioParam ? Number(anioParam) : new Date().getFullYear();
  const acta = await getActaNegociacion(anio);
  const rol = session.user.rol as Rol;

  return <ActaNegociacionClient anio={anio} acta={acta} isSuperAdmin={rol === "superadmin"} />;
}
