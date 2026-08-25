import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { actasAdjudicacion, consolidaciones, configuracion, oferentes, catalogoFirmantes } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { gruposRenglonDeConsolidacion } from "@/lib/adjudicacion/renglon-utils";
import ImprimirActaClient from "./ImprimirActaClient";

interface Props { params: Promise<{ id: string }> }

export default async function ImprimirActaPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const [acta] = await db.select().from(actasAdjudicacion).where(eq(actasAdjudicacion.id, Number(id))).limit(1);
  if (!acta) notFound();

  const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, acta.consolidacion_id)).limit(1);
  if (!con) notFound();

  const oferentesGanadores = await db.select().from(oferentes)
    .where(eq(oferentes.consolidacion_id, con.id)).orderBy(oferentes.orden, oferentes.id);

  const [config, firmantes, renglones] = await Promise.all([
    db.select().from(configuracion).limit(1).then(r => r[0]),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
    gruposRenglonDeConsolidacion(con.id),
  ]);
  // Descripción consolidada del/los insumo(s), solo se usa en el Acta de
  // Compra Directa — a diferencia del DAB-60 (que usa `nombre`, el nombre
  // corto), acá conviene `descripcion_igss` (trae las características,
  // ej. "Refrigerador; Material: Acero inoxidable; ...") porque el modelo
  // del cliente imprime la ficha completa del insumo, no solo su nombre.
  const descripcion = [...new Set(renglones.map(r => (r.descripcion_igss || r.nombre).trim()).filter(Boolean))].join("; ");

  return (
    <ImprimirActaClient
      acta={acta as any}
      consolidacion={con as any}
      oferentes={oferentesGanadores as any}
      nombreUnidad={config?.nombre_unidad_ejecutora ?? config?.nombre_unidad ?? ""}
      municipio={config?.municipio ?? ""}
      direccionUnidad={config?.direccion_unidad ?? ""}
      nombreResponsable={config?.nombre_responsable ?? ""}
      firmantes={firmantes as any}
      descripcion={descripcion}
    />
  );
}
