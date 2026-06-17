import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { parsePermisos, type Rol } from "@/lib/permisos";
import { db } from "@/lib/db";
import { movimientosBanco, pagos } from "@/lib/schema";
import { asc, eq, sum } from "drizzle-orm";
import BancoClient from "./BancoClient";

export default async function BancoPage() {
  const session  = await auth();
  const rol      = session!.user.rol as Rol;
  const permisos = parsePermisos(session!.user.permisos, rol);
  if (!permisos.banco) redirect("/dashboard");

  const lista = await db
    .select()
    .from(movimientosBanco)
    .orderBy(asc(movimientosBanco.id));

  const canEdit = rol !== "consulta";
  return <BancoClient movimientos={lista} canEdit={canEdit} />;
}
