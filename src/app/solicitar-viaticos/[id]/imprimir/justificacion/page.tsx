import { notFound } from "next/navigation";
import { requireColaborador } from "@/lib/modulo-access";
import { db } from "@/lib/db";
import { configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { fechaGuatemala } from "@/lib/date-utils";
import { getSolicitud } from "../../../actions";
import ImprimirNarrativoClient from "@/components/ImprimirNarrativoClient";

export default async function ImprimirJustificacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requireColaborador();
  const { id } = await params;

  const solicitud = await getSolicitud(Number(id));
  if (!solicitud) notFound();
  if (solicitud.colaborador_id !== Number(session.user.id) || solicitud.estado !== "Aprobado") notFound();

  const [config, firmantes] = await Promise.all([
    db.select().from(configuracion).limit(1).then(r => r[0]),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  return (
    <ImprimirNarrativoClient
      titulo={`Justificación de Estancia, según Formulario V-L No. ${solicitud.numero_formulario ?? ""}`}
      nombreUnidad={config?.nombre_dependencia_medica ?? ""}
      destinatarioNombre=""
      destinatarioCargo=""
      // A diferencia del Informe de Comisión (que se dirige automáticamente
      // a quien firmó el nombramiento, ver getFirmantePrincipal), la
      // Justificación de Estancia va dirigida al de la DAF — un firmante
      // distinto que no tiene por qué coincidir con el del nombramiento, así
      // que acá SÍ hace falta elegirlo a mano (pedido explícito del cliente
      // 2026-09-17). Mismo catálogo de siempre (Configuración → Firmantes).
      firmantesDirigidoA={firmantes as any}
      personaNombre={solicitud.persona_nombre}
      personaCargo={solicitud.persona_cargo}
      personaNoEmpleado={solicitud.persona_no_empleado}
      lugarYFecha={`${config?.municipio ?? ""}, ${solicitud.fecha_limite ?? fechaGuatemala()}`}
      texto={solicitud.justificacion_estancia}
    />
  );
}
