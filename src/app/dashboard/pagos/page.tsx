import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { parsePermisos, type Rol } from "@/lib/permisos";
import { db } from "@/lib/db";
import { pagos, servicios, catalogoInsumos } from "@/lib/schema";
import { desc } from "drizzle-orm";
import PagosClient from "./PagosClient";

export default async function PagosPage() {
  const session  = await auth();
  const rol      = session!.user.rol as Rol;
  const permisos = parsePermisos(session!.user.permisos, rol);
  if (!permisos.pagos) redirect("/dashboard");

  const [lista, serviciosList, catalogoList] = await Promise.all([
    db.select().from(pagos).orderBy(desc(pagos.id)).limit(500),
    db.select({
      id: servicios.id, siaf_numero: servicios.siaf_numero,
      insumo: servicios.insumo, cantidad: servicios.cantidad,
      subproducto: servicios.subproducto, codigo_igss: servicios.codigo_igss,
      numero_compra: servicios.numero_compra,
    }).from(servicios).orderBy(desc(servicios.id)).limit(200),
    db.select({
      codigo_igss: catalogoInsumos.codigo_igss,
      nombre: catalogoInsumos.nombre,
      subproducto: catalogoInsumos.subproducto,
      codigo_ppr: catalogoInsumos.codigo_ppr,
      unidad_medida: catalogoInsumos.unidad_medida,
    }).from(catalogoInsumos).where(catalogoInsumos.activo),
  ]);

  const canEdit = rol !== "consulta";
  return <PagosClient pagos={lista} servicios={serviciosList} catalogo={catalogoList} canEdit={canEdit} />;
}
