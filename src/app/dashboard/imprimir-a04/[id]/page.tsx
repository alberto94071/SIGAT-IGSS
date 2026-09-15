import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { consolidaciones, configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { gruposRenglonDeConsolidacion, pprPuroParaImprimir } from "@/lib/adjudicacion/renglon-utils";
import ImprimirA04Client from "@/app/compras/adjudicacion/[id]/imprimir-a04/ImprimirA04Client";

// Mismo componente y misma data que
// compras/adjudicacion/[id]/imprimir-a04/page.tsx — solo cambia el layout
// que lo envuelve (acá cuelga de dashboard/layout.tsx, Fondo Rotativo, en
// vez de compras/layout.tsx). Se llega acá desde Fondo Rotativo/SIAF-04 y
// Fondo Rotativo/Archivo, que antes mandaban a la ruta de Compras y
// mostraban esa navbar aunque el A-04 se hubiera generado desde acá
// (reportado por el cliente 2026-09-16). La ruta vieja bajo compras/ se
// deja para Hoja de Ruta, que no reportó el mismo problema.
interface Props { params: Promise<{ id: string }>; searchParams: Promise<{ firmantes?: string }> }

export default async function ImprimirA04FondoRotativoPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const { firmantes: firmantesParam } = await searchParams;

  const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, Number(id))).limit(1);
  if (!con || !con.numero_a04) notFound();

  const [config, todosFirmantes] = await Promise.all([
    db.select().from(configuracion).limit(1),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  const renglones = await gruposRenglonDeConsolidacion(con.id);

  const pprPuroMap = await pprPuroParaImprimir(renglones.map(r => r.codigo_ppr));
  const pprPuro = Object.fromEntries(pprPuroMap);

  const ids = firmantesParam ? firmantesParam.split(",").map(Number).filter(Boolean) : [];
  const firmantesSeleccionados = ids.length > 0
    ? await db.select().from(catalogoFirmantes).where(inArray(catalogoFirmantes.id, ids))
    : [];

  return (
    <ImprimirA04Client
      consolidacion={con as any}
      renglones={renglones}
      pprPuro={pprPuro}
      nombreUnidad={config[0]?.nombre_unidad ?? ""}
      codigoUnidad={config[0]?.codigo_unidad ?? ""}
      direccionUnidad={config[0]?.direccion_unidad ?? ""}
      todosFirmantes={todosFirmantes as any}
      firmantesSeleccionados={firmantesSeleccionados as any}
    />
  );
}
