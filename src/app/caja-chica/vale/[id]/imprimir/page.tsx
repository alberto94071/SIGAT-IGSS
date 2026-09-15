import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { valesCajaChica, configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { getPosicionesImpresion } from "@/lib/impresion-posiciones-actions";
import ImprimirValeClient from "./ImprimirValeClient";

interface Props { params: Promise<{ id: string }> }

export default async function ImprimirValePage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const [vale, config, posicionesGuardadas, firmantes] = await Promise.all([
    db.select().from(valesCajaChica).where(eq(valesCajaChica.id, Number(id))).limit(1).then(r => r[0]),
    db.select().from(configuracion).limit(1).then(r => r[0]),
    getPosicionesImpresion("vale"),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);
  if (!vale) notFound();

  return (
    <ImprimirValeClient
      vale={vale}
      municipio={config?.municipio ?? ""}
      nombreDependencia={config?.nombre_dependencia_medica ?? ""}
      nombreResponsable={config?.nombre_responsable ?? ""}
      numeroEmpleadoResp={config?.numero_empleado_resp ?? ""}
      nitResponsable={config?.nit_responsable ?? ""}
      posicionesGuardadas={posicionesGuardadas}
      firmantes={firmantes}
    />
  );
}
