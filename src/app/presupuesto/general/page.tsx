import PresupuestoGeneralClient from "./PresupuestoGeneralClient";
import { getPresupuestoGeneralData } from "@/lib/presupuesto-general-actions";
import { requireTabAccess } from "@/lib/modulo-access";

export default async function PresupuestoGeneralPage() {
  await requireTabAccess("mod_presupuesto", "tab_presupuesto_general");
  const renglones = await getPresupuestoGeneralData();

  return (
    <div className="space-y-8">
      <PresupuestoGeneralClient data={renglones} />
    </div>
  );
}
