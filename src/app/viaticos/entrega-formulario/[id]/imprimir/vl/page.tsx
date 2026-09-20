import { notFound } from "next/navigation";
import { requireTabAccess } from "@/lib/modulo-access";
import { db } from "@/lib/db";
import { configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { getSolicitudParaImprimir } from "../../../../registro-comision/actions";
import { getPosicionesImpresion } from "@/lib/impresion-posiciones-actions";
import { preciosPorGrupo } from "@/lib/viatico-precios";
import ImprimirVLClient from "./ImprimirVLClient";

export default async function ImprimirVLPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTabAccess("mod_viaticos", "tab_viaticos_entrega");
  const { id } = await params;

  const solicitud = await getSolicitudParaImprimir(Number(id));
  if (!solicitud) notFound();
  if (solicitud.estado !== "Aprobado") notFound();

  const [config, firmantes, posicionesGuardadas] = await Promise.all([
    db.select().from(configuracion).limit(1).then(r => r[0]),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
    getPosicionesImpresion("viatico_vl"),
  ]);

  return (
    <ImprimirVLClient
      solicitud={solicitud}
      entidadRecibio={config?.entidad_recibio_viatico ?? ""}
      municipio={config?.municipio ?? ""}
      partidaPresupuestaria={config?.viatico_partida_presupuestaria ?? ""}
      precios={preciosPorGrupo(solicitud.persona_grupo, {
        viatico_cuota_grupo_1_2: config?.viatico_cuota_grupo_1_2 ?? 600, viatico_cuota_grupo_3: config?.viatico_cuota_grupo_3 ?? 500,
        viatico_cuota_grupo_4: config?.viatico_cuota_grupo_4 ?? 400, viatico_cuota_grupo_5: config?.viatico_cuota_grupo_5 ?? 300,
      })}
      firmantes={firmantes as any}
      posicionesGuardadas={posicionesGuardadas}
    />
  );
}
