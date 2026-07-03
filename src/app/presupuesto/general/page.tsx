import { getPendientesPorDestino } from "@/lib/adjudicacion/actions";
import BandejaDestino from "@/components/adjudicacion/BandejaDestino";
import PresupuestoRenglonesTable from "./PresupuestoRenglonesTable";
import { db } from "@/lib/db";
import { presupuestoRenglones } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";

export default async function PresupuestoGeneralPage() {
  const [consolidaciones, renglones] = await Promise.all([
    getPendientesPorDestino("presupuesto"),
    db.select().from(presupuestoRenglones)
      .where(eq(presupuestoRenglones.ejercicio_fiscal, 2026))
      .orderBy(asc(presupuestoRenglones.renglon)),
  ]);

  return (
    <div className="space-y-8">
      <BandejaDestino consolidaciones={consolidaciones} titulo="Presupuesto — General" />
      <PresupuestoRenglonesTable renglones={renglones} />
    </div>
  );
}
