import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { presupuestoRenglones, catalogoCompras } from "@/lib/schema";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import PresupuestoClient from "./PresupuestoClient";

export default async function PresupuestoPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [renglones, catalogo] = await Promise.all([
    db.select().from(presupuestoRenglones).orderBy(asc(presupuestoRenglones.renglon)),
    db.select({
      id:              catalogoCompras.id,
      codigo_ppr:      catalogoCompras.codigo_ppr,
      codigo_igss:     catalogoCompras.codigo_igss,
      nombre:          catalogoCompras.nombre,
      caracteristicas: catalogoCompras.caracteristicas,
      presentacion:    catalogoCompras.presentacion,
      subproducto:     catalogoCompras.subproducto,
      cantidad:        catalogoCompras.cantidad,
    }).from(catalogoCompras).orderBy(asc(catalogoCompras.nombre)),
  ]);

  return <PresupuestoClient renglones={renglones} catalogo={catalogo} />;
}
