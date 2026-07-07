import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getLiquidacion } from "../../actions";
import ImprimirViaticoClient from "./ImprimirViaticoClient";

export default async function ImprimirViaticoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const liquidacion = await getLiquidacion(Number(id));
  if (!liquidacion) notFound();
  const [config] = await db.select().from(configuracion).limit(1);

  return (
    <ImprimirViaticoClient
      liquidacion={liquidacion}
      entidadRecibio={config?.entidad_recibio_viatico ?? ""}
      municipio={config?.municipio ?? ""}
      nombreResponsable={config?.nombre_responsable ?? ""}
      nombreEncargadoUnidad={config?.nombre_encargado_unidad ?? ""}
      cargoEncargadoUnidad={config?.cargo_encargado_unidad ?? ""}
    />
  );
}
