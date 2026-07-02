import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { consolidaciones, configuracion, siafCompras } from "@/lib/schema";
import { eq } from "drizzle-orm";
import ImprimirA04Client from "./ImprimirA04Client";

interface Props { params: Promise<{ id: string }> }

export default async function ImprimirA04Page({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, Number(id))).limit(1);
  if (!con || !con.numero_a04) notFound();

  const [config] = await db.select().from(configuracion).limit(1);
  const siafs = await db.select({ numero: siafCompras.numero, anio: siafCompras.anio })
    .from(siafCompras).where(eq(siafCompras.consolidacion_id, con.id));

  return (
    <ImprimirA04Client
      consolidacion={con as any}
      siafs={siafs}
      nombreUnidad={config?.nombre_unidad_ejecutora ?? config?.nombre_unidad ?? ""}
      codigoUnidad={config?.codigo_unidad ?? ""}
      codigoContable={config?.codigo_contable ?? ""}
      direccionUnidad={config?.direccion_unidad ?? ""}
      municipio={config?.municipio ?? ""}
      nombreResponsable={config?.nombre_responsable ?? ""}
      numeroEmpleadoResp={config?.numero_empleado_resp ?? ""}
      nombreSolicitante={config?.nombre_solicitante ?? ""}
      numeroEmpleadoSol={config?.numero_empleado_sol ?? ""}
    />
  );
}
