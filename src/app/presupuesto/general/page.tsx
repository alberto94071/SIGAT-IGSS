import PresupuestoRenglonesTable from "./PresupuestoRenglonesTable";
import { db } from "@/lib/db";
import { presupuestoRenglones } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";

export default async function PresupuestoGeneralPage() {
  const renglones = await db.select().from(presupuestoRenglones)
    .where(eq(presupuestoRenglones.ejercicio_fiscal, 2026))
    .orderBy(asc(presupuestoRenglones.renglon));

  return (
    <div className="space-y-8">
      <PresupuestoRenglonesTable renglones={renglones} />
    </div>
  );
}
