import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { presupuestoRenglones } from "@/lib/schema";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import PresupuestoClient from "./PresupuestoClient";

export default async function PresupuestoPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const renglones = await db
    .select()
    .from(presupuestoRenglones)
    .orderBy(asc(presupuestoRenglones.renglon));

  return <PresupuestoClient renglones={renglones} />;
}
