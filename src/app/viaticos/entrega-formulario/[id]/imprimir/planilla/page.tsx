import { notFound } from "next/navigation";
import { requireTabAccess } from "@/lib/modulo-access";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { fechaGuatemala } from "@/lib/date-utils";
import { getSolicitudParaImprimir } from "../../../../registro-comision/actions";
import ImprimirPlanillaClient from "./ImprimirPlanillaClient";

export default async function ImprimirPlanillaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTabAccess("mod_viaticos", "tab_viaticos_entrega");
  const { id } = await params;

  const solicitud = await getSolicitudParaImprimir(Number(id));
  if (!solicitud) notFound();
  if (solicitud.estado !== "Aprobado") notFound();

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
