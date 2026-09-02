import { notFound } from "next/navigation";
import { requireTabAccess } from "@/lib/modulo-access";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getSolicitudParaImprimir } from "../../../../registro-comision/actions";
import ImprimirVCClient from "./ImprimirVCClient";
import { nombramientosUnicos } from "./nombramientos-utils";

export default async function ImprimirVCPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTabAccess("mod_viaticos", "tab_viaticos_entrega");
  const { id } = await params;

  const solicitud = await getSolicitudParaImprimir(Number(id));
  if (!solicitud) notFound();
  if (solicitud.estado !== "Aprobado") notFound();

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
