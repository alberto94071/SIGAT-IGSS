import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { siafCompras, siafComprasItems, catalogoFirmantes, configuracion } from "@/lib/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { renglonLookupMap, codigoPprLookupMap, codigoPprSinCodigoLookupMap, normalizaNombre, SIN_CODIGO } from "@/lib/adjudicacion/renglon-utils";
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
  const codigosItems = [...new Set(
    items.map(i => i.codigo_igss).filter((c): c is string => c != null && c !== SIN_CODIGO)
  )];
  const pprMap = await codigoPprLookupMap(codigosItems);
  // Los ítems "S/C" (sin código real) no tienen codigo_igss por el que
  // buscar — se resuelven aparte, por nombre (ver codigoPprSinCodigoLookupMap).
  const pprSinCodigoMap = await codigoPprSinCodigoLookupMap(
    items.filter(i => i.codigo_ppr == null && (i.codigo_igss == null || i.codigo_igss === SIN_CODIGO))
      .map(i => ({ nombre: i.nombre, descripcion_igss: i.descripcion_igss }))
  );
  const itemsConPpr = items.map(i => {
    if (i.codigo_ppr) return i;
    if (i.codigo_igss && i.codigo_igss !== SIN_CODIGO) {
      return { ...i, codigo_ppr: pprMap.get(`${i.codigo_igss}::${normalizaNombre(i.nombre)}`) ?? pprMap.get(i.codigo_igss) ?? null };
    }
    const clave = `${i.nombre.trim()}::${(i.descripcion_igss ?? "").trim()}`;
    return { ...i, codigo_ppr: pprSinCodigoMap.get(clave) ?? null };
  });

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
