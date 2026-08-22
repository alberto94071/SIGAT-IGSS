import { db } from "@/lib/db";
import { siafCompras, siafComprasItems } from "@/lib/schema";
import { desc, asc, eq } from "drizzle-orm";
import { requireTabAccess } from "@/lib/modulo-access";
import { renglonLookupMap } from "@/lib/adjudicacion/renglon-utils";
import ConsolidacionClient from "./ConsolidacionClient";

export default async function ConsolidacionPage() {
  const { rol } = await requireTabAccess("mod_compras", "tab_compras_consolidacion");
  const canEdit = rol !== "consulta";

  const [solicitudesList, itemsList, renglonMap] = await Promise.all([
    db.select().from(siafCompras).where(eq(siafCompras.estado, "Aprobado")).orderBy(desc(siafCompras.id)),
    db.select().from(siafComprasItems).orderBy(asc(siafComprasItems.id)),
    renglonLookupMap(),
  ]);

  const solicitudes = solicitudesList.map(s => ({
    ...s,
    items: itemsList.filter(i => i.solicitud_id === s.id).map(i => ({
      ...i, renglon: renglonMap.get(`${i.codigo_igss}::${i.subproducto}::${i.nombre}`) ?? null,
    })),
  }));

  return <ConsolidacionClient solicitudes={solicitudes as any} canEdit={canEdit} />;
}
