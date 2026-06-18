import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { parsePermisos, type Rol } from "@/lib/permisos";
import { db } from "@/lib/db";
import { servicios, catalogoInsumos, catalogoSubproductos } from "@/lib/schema";
import { desc, eq, asc } from "drizzle-orm";
import ServiciosClient from "./ServiciosClient";

export default async function ServiciosPage() {
  const session = await auth();
  const rol     = session!.user.rol as Rol;
  const permisos = parsePermisos(session!.user.permisos, rol);
  if (!permisos.servicios) redirect("/dashboard");

  const [lista, catalogo, subprodLista] = await Promise.all([
    db.select().from(servicios).orderBy(desc(servicios.id)).limit(500),
    db.select({
      codigo_igss:     catalogoInsumos.codigo_igss,
      nombre:          catalogoInsumos.nombre,
      subproducto:     catalogoInsumos.subproducto,
      unidad_medida:   catalogoInsumos.unidad_medida,
      precio_unitario: catalogoInsumos.precio_unitario,
    })
    .from(catalogoInsumos)
    .where(eq(catalogoInsumos.activo, true)),
    db.select({ nombre: catalogoSubproductos.nombre })
      .from(catalogoSubproductos)
      .where(eq(catalogoSubproductos.activo, true))
      .orderBy(asc(catalogoSubproductos.nombre)),
  ]);

  const canEdit = rol !== "consulta";
  return (
    <ServiciosClient
      servicios={lista as any}
      catalogo={catalogo as any}
      subproductos={subprodLista.map(s => s.nombre)}
      canEdit={canEdit}
      userId={Number(session!.user.id)}
    />
  );
}
