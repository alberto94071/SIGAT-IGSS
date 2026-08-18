import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { getLiquidacion } from "../../actions";
import ImprimirViaticoClient from "./ImprimirViaticoClient";

export default async function ImprimirViaticoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const liquidacion = await getLiquidacion(Number(id));
  if (!liquidacion) notFound();
  const [[config], firmantes] = await Promise.all([
    db.select().from(configuracion).limit(1),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  return (
    <ImprimirViaticoClient
      liquidacion={liquidacion}
      entidadRecibio={config?.entidad_recibio_viatico ?? ""}
      municipio={config?.municipio ?? ""}
      nombreResponsable={config?.nombre_responsable ?? ""}
      firmantes={firmantes as any}
    />
  );
}
