import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { parsePermisos, type Rol } from "@/lib/permisos";
import { db } from "@/lib/db";
import { cajaChica } from "@/lib/schema";
import { desc } from "drizzle-orm";
import CajaChicaClient from "./CajaChicaClient";

export default async function CajaChicaPage() {
  const session  = await auth();
  const rol      = session!.user.rol as Rol;
  const permisos = parsePermisos(session!.user.permisos, rol);
  if (!permisos.caja_chica) redirect("/dashboard");

  const lista = await db.select().from(cajaChica).orderBy(desc(cajaChica.id)).limit(500);
  const canEdit = rol !== "consulta";
  return <CajaChicaClient gastos={lista} canEdit={canEdit} />;
}
