import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { parsePermisos, type Rol } from "@/lib/permisos";
import { db } from "@/lib/db";
import { servicios, catalogoInsumos } from "@/lib/schema";
import { desc } from "drizzle-orm";
import ServiciosClient from "./ServiciosClient";

export default async function ServiciosPage() {
  const session = await auth();
  const rol     = session!.user.rol as Rol;
  const permisos = parsePermisos(session!.user.permisos, rol);
  if (!permisos.servicios) redirect("/dashboard");

  const [lista, catalogo] = await Promise.all([
    db.select().from(servicios).orderBy(desc(servicios.id)).limit(500),
    db.select({
      codigo_igss:  catalogoInsumos.codigo_igss,
      nombre:       catalogoInsumos.nombre,
      subproducto:  catalogoInsumos.subproducto,
      unidad_medida:catalogoInsumos.unidad_medida,
    })
    .from(catalogoInsumos)
    .where(catalogoInsumos.activo),   // solo activos
  ]);

  const canEdit = rol !== "consulta";
  return (
    <ServiciosClient
      servicios={lista}
      catalogo={catalogo}
      canEdit={canEdit}
      userId={Number(session!.user.id)}
    />
  );
}
