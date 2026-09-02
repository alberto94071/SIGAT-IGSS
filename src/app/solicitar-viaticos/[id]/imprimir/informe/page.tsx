import { notFound } from "next/navigation";
import { requireColaborador } from "@/lib/modulo-access";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { fechaGuatemala } from "@/lib/date-utils";
import { getSolicitud } from "../../../actions";
import ImprimirNarrativoClient from "@/components/ImprimirNarrativoClient";

export default async function ImprimirInformePage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requireColaborador();
  const { id } = await params;

  const solicitud = await getSolicitud(Number(id));
  if (!solicitud) notFound();
  if (solicitud.colaborador_id !== Number(session.user.id) || solicitud.estado !== "Aprobado") notFound();

  const [config] = await db.select().from(configuracion).limit(1);

  return (
    <ImprimirNarrativoClient
      titulo={`Informe de Comisión, según Formulario No. ${solicitud.numero_formulario ?? ""}`}
      nombreUnidad={config?.nombre_dependencia_medica ?? ""}
      destinatarioNombre={config?.nombre_director ?? ""}
      destinatarioCargo="Director Departamental"
      personaNombre={solicitud.persona_nombre}
      personaCargo={solicitud.persona_cargo}
      personaNoEmpleado={solicitud.persona_no_empleado}
      lugarYFecha={`${config?.municipio ?? ""}, ${fechaGuatemala()}`}
      texto={solicitud.informe_comision}
    />
  );
}
