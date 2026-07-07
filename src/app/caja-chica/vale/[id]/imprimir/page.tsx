import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { valesCajaChica, configuracion } from "@/lib/schema";
import { eq } from "drizzle-orm";
import ImprimirValeClient from "./ImprimirValeClient";

interface Props { params: Promise<{ id: string }> }

export default async function ImprimirValePage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const [vale] = await db.select().from(valesCajaChica).where(eq(valesCajaChica.id, Number(id))).limit(1);
  if (!vale) notFound();

  const [config] = await db.select().from(configuracion).limit(1);

  return (
    <ImprimirValeClient
      vale={vale}
      municipio={config?.municipio ?? ""}
      nombreDependencia={config?.nombre_dependencia_medica ?? ""}
      nombreResponsable={config?.nombre_responsable ?? ""}
      numeroEmpleadoResp={config?.numero_empleado_resp ?? ""}
      nitResponsable={config?.nit_responsable ?? ""}
    />
  );
}
