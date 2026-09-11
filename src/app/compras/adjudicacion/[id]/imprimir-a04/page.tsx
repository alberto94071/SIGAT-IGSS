import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { consolidaciones, configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { gruposRenglonDeConsolidacion, pprPuroParaImprimir } from "@/lib/adjudicacion/renglon-utils";
import ImprimirA04Client from "./ImprimirA04Client";

interface Props { params: Promise<{ id: string }>; searchParams: Promise<{ firmantes?: string }> }

export default async function ImprimirA04Page({ params, searchParams }: Props) {
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

  // El cliente pidió (2026-09-11) que "Código PpR" imprima solo el número
  // de PPR, sin el prefijo de código IGSS que arma codigoDeOpcion al elegir
  // la presentación (ej. "4877 - 28700", no "93279-4877 - 28700") —
  // reversa de una decisión anterior que sí lo pedía compuesto. Mismo
  // helper que ya usa el DAB-60 para esto (pprPuroParaImprimir).
  const pprPuroMap = await pprPuroParaImprimir(renglones.map(r => r.codigo_ppr));
  const pprPuro = Object.fromEntries(pprPuroMap);

  // Firmantes seleccionados vienen por query param: "1,3,5"
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
