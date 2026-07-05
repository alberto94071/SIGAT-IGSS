import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { siafCompras, siafComprasItems } from "@/lib/schema";
import { desc, asc, eq } from "drizzle-orm";
import { type Rol } from "@/lib/permisos";
import ConsolidacionClient from "./ConsolidacionClient";

export default async function ConsolidacionPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";

  const [solicitudesList, itemsList] = await Promise.all([
    db.select().from(siafCompras).where(eq(siafCompras.estado, "Aprobado")).orderBy(desc(siafCompras.id)),
    db.select().from(siafComprasItems).orderBy(asc(siafComprasItems.id)),
  ]);

  const solicitudes = solicitudesList.map(s => ({
    ...s,
    items: itemsList.filter(i => i.solicitud_id === s.id),
  }));

  return <ConsolidacionClient solicitudes={solicitudes as any} canEdit={canEdit} />;
}
