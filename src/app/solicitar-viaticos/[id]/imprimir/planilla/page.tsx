import { notFound } from "next/navigation";
import { requireColaborador } from "@/lib/modulo-access";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { fechaGuatemala } from "@/lib/date-utils";
import { getSolicitudParaImprimir } from "@/app/viaticos/registro-comision/actions";
import ImprimirPlanillaClient from "@/app/viaticos/entrega-formulario/[id]/imprimir/planilla/ImprimirPlanillaClient";

export default async function ImprimirMiPlanillaPage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requireColaborador();
  const { id } = await params;

  const solicitud = await getSolicitudParaImprimir(Number(id));
  if (!solicitud) notFound();
  if (solicitud.colaborador_id !== Number(session.user.id) || solicitud.estado !== "Aprobado") notFound();

  const config = await db.select().from(configuracion).limit(1).then(r => r[0]);
  const primera = solicitud.comisiones[0];

  return (
    <ImprimirPlanillaClient
      numeroFormulario={solicitud.numero_formulario}
      nombreUnidad={config?.nombre_dependencia_medica ?? ""}
      direccionUnidad={config?.direccion_unidad ?? ""}
      lugarComision={[primera?.lugar, primera?.departamento].filter(Boolean).join(", ")}
      fechaComision={primera?.fecha_llegada_lugar ?? null}
      horaInicio={primera?.hora_llegada_lugar ?? null}
      horaFin={primera?.hora_salida_lugar ?? null}
      personaNombre={solicitud.persona_nombre}
      personaCargo={solicitud.persona_cargo}
      personaNoEmpleado={solicitud.persona_no_empleado}
      personaNit={solicitud.persona_nit}
      personaSueldo={solicitud.persona_sueldo}
      fechaSalidaUnidad={primera?.fecha_salida_unidad ?? null}
      horaSalidaUnidad={primera?.hora_salida_unidad ?? null}
      fechaEntradaUnidad={primera?.fecha_entrada_unidad ?? null}
      horaEntradaUnidad={primera?.hora_entrada_unidad ?? null}
      gastos={solicitud.gastos}
      lugarYFecha={`${config?.municipio ?? ""}, ${fechaGuatemala()}`}
    />
  );
}
