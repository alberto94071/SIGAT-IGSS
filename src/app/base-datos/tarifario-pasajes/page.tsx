import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { listarTarifarioPaginado } from "@/lib/pasajes-actions";
import TarifarioClient from "@/components/TarifarioClient";

interface Props { searchParams: Promise<{ q?: string; delegacion?: string; page?: string }> }

export default async function TarifarioPasajesPage({ searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";

  const { q, delegacion, page } = await searchParams;
  const { registros, totalCount, limit, delegaciones } = await listarTarifarioPaginado({
    q, delegacion, page: page ? Number(page) : 1,
  });

  return (
    <TarifarioClient
      registros={registros} totalCount={totalCount} currentPage={page ? Number(page) : 1} limit={limit}
      delegaciones={delegaciones} initQ={q ?? ""} initDelegacion={delegacion ?? ""} canEdit={canEdit}
    />
  );
}
