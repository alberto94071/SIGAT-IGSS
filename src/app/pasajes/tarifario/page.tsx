import { requireTabAccess } from "@/lib/modulo-access";
import { listarTarifarioPaginado } from "@/lib/pasajes-actions";
import TarifarioClient from "@/components/TarifarioClient";

interface Props { searchParams: Promise<{ q?: string; delegacion?: string; page?: string }> }

export default async function TarifarioPage({ searchParams }: Props) {
  const { rol } = await requireTabAccess("mod_pasajes", "tab_pasajes_tarifario");
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
