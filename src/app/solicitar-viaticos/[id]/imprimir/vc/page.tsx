import { notFound } from "next/navigation";
import { requireColaborador } from "@/lib/modulo-access";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getSolicitudParaImprimir } from "@/app/viaticos/registro-comision/actions";
import ImprimirVCClient from "@/app/viaticos/entrega-formulario/[id]/imprimir/vc/ImprimirVCClient";
import { nombramientosUnicos } from "@/app/viaticos/entrega-formulario/[id]/imprimir/vc/nombramientos-utils";

export default async function ImprimirMiVCPage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requireColaborador();
  const { id } = await params;

  const solicitud = await getSolicitudParaImprimir(Number(id));
  if (!solicitud) notFound();
  if (solicitud.colaborador_id !== Number(session.user.id) || solicitud.estado !== "Aprobado") notFound();

  const [config] = await db.select().from(configuracion).limit(1);

  return (
    <ImprimirVCClient
      numeroFormulario={solicitud.numero_formulario}
      personaNombre={solicitud.persona_nombre}
      personaCargo={solicitud.persona_cargo}
      personaNit={solicitud.persona_nit}
      personaNoEmpleado={solicitud.persona_no_empleado}
      dependencia={config?.nombre_dependencia_medica ?? ""}
      nombramientos={nombramientosUnicos(solicitud.comisiones)}
    />
  );
}
