import PresupuestoGeneralClient from "./PresupuestoGeneralClient";
import { getPresupuestoGeneralData } from "@/lib/presupuesto-general-actions";

export default async function PresupuestoGeneralPage() {
  const renglones = await getPresupuestoGeneralData();

  return (
    <div className="space-y-8">
      <PresupuestoGeneralClient data={renglones} />
    </div>
  );
}
