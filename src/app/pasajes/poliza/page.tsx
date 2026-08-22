import { requireTabAccess } from "@/lib/modulo-access";
import { listarDpd23SinPoliza, listarPolizas } from "@/lib/poliza-actions";
import { getValeActivo } from "@/lib/vale-actions";
import PolizaClient from "./PolizaClient";

export default async function PolizaPage() {
  const { rol } = await requireTabAccess("mod_pasajes", "tab_pasajes_poliza");
  const canEdit = rol !== "consulta";

  const [dpd23SinPoliza, polizas, valeActivo] = await Promise.all([
    listarDpd23SinPoliza(),
    listarPolizas(),
    getValeActivo("pasajes"),
  ]);

  return (
    <PolizaClient
      dpd23SinPoliza={dpd23SinPoliza}
      polizas={polizas}
      valeActivo={valeActivo}
      canEdit={canEdit}
    />
  );
}
