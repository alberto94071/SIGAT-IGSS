import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoFirmantes, configuracion } from "@/lib/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { renglonLookupMap, codigoPprLookupMap, normalizaNombre } from "@/lib/adjudicacion/renglon-utils";
import ImprimirClient from "./ImprimirClient";

interface Props { params: Promise<{ id: string }>; searchParams: Promise<{ firmantes?: string }> }

export default async function ImprimirPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const { firmantes: firmantesParam } = await searchParams;

  const [solicitud, config, todosFirmantes] = await Promise.all([
    db.select().from(siafCompras).where(eq(siafCompras.id, Number(id))).limit(1),
    db.select().from(configuracion).limit(1),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  if (!solicitud[0]) notFound();

  const items = await db
    .select().from(siafComprasItems)
    .where(eq(siafComprasItems.solicitud_id, Number(id)))
    .orderBy(asc(siafComprasItems.id));

  // El sub-producto solo se imprime junto al insumo si el SIAF trae por lo
  // menos un insumo del renglón 182 — en cualquier otro caso se omite y la
  // descripción ocupa todo el ancho de la casilla.
  const renglones = await renglonLookupMap();
  const mostrarSubproducto = items.some(i =>
    renglones.get(`${i.codigo_igss}::${i.subproducto}::${i.nombre}`) === 182
  );

  // Respaldo del código PPR para SIAFs que todavía no pasaron por la
  // selección de Consolidación (ver comentario en codigoPprLookupMap).
  const codigosItems = [...new Set(items.map(i => i.codigo_igss).filter((c): c is string => c != null))];
  const pprMap = await codigoPprLookupMap(codigosItems);
  const itemsConPpr = items.map(i => ({
    ...i,
    codigo_ppr: i.codigo_ppr ?? (i.codigo_igss ? pprMap.get(`${i.codigo_igss}::${normalizaNombre(i.nombre)}`) ?? null : null),
  }));

  // Firmantes seleccionados vienen por query param: "1,3"
  const ids = firmantesParam ? firmantesParam.split(",").map(Number).filter(Boolean) : [];
  const firmantesSeleccionados = ids.length > 0
    ? await db.select().from(catalogoFirmantes).where(inArray(catalogoFirmantes.id, ids))
    : [];

  const sol = solicitud[0] as any;
  // Justificación: usa la propia de la solicitud, si no tiene usa la del config
  const justificacion = sol.observaciones || config[0]?.justificacion_siaf || "";

  return (
    <ImprimirClient
      solicitud={sol}
      items={itemsConPpr as any}
      config={{ ...(config[0] as any), justificacion_siaf: justificacion }}
      todosFirmantes={todosFirmantes as any}
      firmantesSeleccionados={firmantesSeleccionados as any}
      mostrarSubproducto={mostrarSubproducto}
      impresoPor={session.user.name ?? session.user.email ?? "Usuario"}
    />
  );
}
