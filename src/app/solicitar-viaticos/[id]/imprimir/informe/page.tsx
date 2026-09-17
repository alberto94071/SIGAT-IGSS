import { notFound } from "next/navigation";
import { requireColaborador } from "@/lib/modulo-access";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { fechaGuatemala } from "@/lib/date-utils";
import { getSolicitud, getFirmantePrincipal } from "../../../actions";
import ImprimirNarrativoClient from "@/components/ImprimirNarrativoClient";

export default async function ImprimirInformePage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requireColaborador();
  const { id } = await params;

  const solicitud = await getSolicitud(Number(id));
  if (!solicitud) notFound();
  if (solicitud.colaborador_id !== Number(session.user.id) || solicitud.estado !== "Aprobado") notFound();

  const [config, firmante] = await Promise.all([
    db.select().from(configuracion).limit(1).then(r => r[0]),
    getFirmantePrincipal(solicitud.id),
  ]);

  return (
    <ImprimirNarrativoClient
      titulo={`Informe de Comisión, según Formulario No. ${solicitud.numero_formulario ?? ""}`}
      nombreUnidad={config?.nombre_dependencia_medica ?? ""}
      destinatarioNombre={firmante?.nombre ?? config?.nombre_director ?? ""}
      destinatarioCargo={firmante?.cargo ?? "Director Departamental"}
      personaNombre={solicitud.persona_nombre}
      personaCargo={solicitud.persona_cargo}
      personaNoEmpleado={solicitud.persona_no_empleado}
      // La fecha de cierre es el límite de 10 días hábiles desde el
      // nombramiento (fecha_limite, ya calculado al habilitar) — no la
      // fecha real de impresión/reimpresión, que podía ser cualquier día
      // posterior (reportado por el cliente 2026-09-17, con capturas
      // mostrando el día de la reimpresión en vez del límite real).
      lugarYFecha={`${config?.municipio ?? ""}, ${solicitud.fecha_limite ?? fechaGuatemala()}`}
      texto={solicitud.informe_comision}
    />
  );
}
