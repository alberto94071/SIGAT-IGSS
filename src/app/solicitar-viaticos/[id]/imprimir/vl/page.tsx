import { notFound } from "next/navigation";
import { requireColaborador } from "@/lib/modulo-access";
import { db } from "@/lib/db";
import { configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { getSolicitudParaImprimir } from "@/app/viaticos/registro-comision/actions";
import ImprimirVLClient from "@/app/viaticos/entrega-formulario/[id]/imprimir/vl/ImprimirVLClient";

export default async function ImprimirMiVLPage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requireColaborador();
  const { id } = await params;

  const solicitud = await getSolicitudParaImprimir(Number(id));
  if (!solicitud) notFound();
  if (solicitud.colaborador_id !== Number(session.user.id) || solicitud.estado !== "Aprobado") notFound();

  const [config, firmantes] = await Promise.all([
    db.select().from(configuracion).limit(1).then(r => r[0]),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  return (
    <ImprimirVLClient
      solicitud={solicitud}
      entidadRecibio={config?.entidad_recibio_viatico ?? ""}
      municipio={config?.municipio ?? ""}
      nombreResponsable={config?.nombre_responsable ?? ""}
      partidaPresupuestaria={config?.viatico_partida_presupuestaria ?? ""}
      precios={{
        desayuno: config?.viatico_precio_desayuno ?? 45, almuerzo: config?.viatico_precio_almuerzo ?? 60,
        cena: config?.viatico_precio_cena ?? 45, hospedaje: config?.viatico_precio_hospedaje ?? 150,
      }}
      firmantes={firmantes as any}
    />
  );
}
