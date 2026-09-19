import { notFound } from "next/navigation";
import { requireTabAccess } from "@/lib/modulo-access";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { fechaGuatemala } from "@/lib/date-utils";
import { getSolicitudParaImprimir } from "../../../../registro-comision/actions";
import ImprimirPlanillaClient from "./ImprimirPlanillaClient";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// "2026-08-10" → "10 de agosto de 2026." — el cliente pidió (2026-09-19)
// que "Lugar y fecha" ya no imprima la fecha real de impresión (quedaba con
// hoy). Primer intento (revertido el mismo día): usar el último día de la
// comisión (fecha_entrada_unidad) — el cliente aclaró que no es esa, es la
// fecha límite de los 10 días hábiles que tienen para PRESENTAR el trámite
// (mismo `fecha_limite` que ya usan Informe de Comisión/Justificación de
// Estancia desde el 2026-09-17, ver el punto de arriba) — no un dato nuevo,
// mismo campo ya calculado al habilitar (`sumarDiasHabiles`).
function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}.`;
}

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
      lugarYFecha={`${config?.municipio ?? ""}, ${fechaLarga(solicitud.fecha_limite ?? fechaGuatemala())}`}
    />
  );
}
