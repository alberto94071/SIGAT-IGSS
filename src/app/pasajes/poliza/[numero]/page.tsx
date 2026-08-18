import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { getPolizaPorNumero } from "@/lib/poliza-actions";
import ImprimirPolizaClient from "./ImprimirPolizaClient";

export default async function PolizaImprimirPage({ params }: { params: Promise<{ numero: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { numero } = await params;
  const res = await getPolizaPorNumero(Number(numero));
  if (!res) notFound();

  const [config, firmantes] = await Promise.all([
    db.select().from(configuracion).limit(1).then(r => r[0]),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  return (
    <ImprimirPolizaClient
      poliza={res.poliza}
      items={res.items}
      codigoContable={config?.codigo_contable ?? "12.07.04"}
      nombreUnidad={config?.nombre_unidad ?? "Consultorio de Tacaná, Departamento de San Marcos"}
      firmantes={firmantes as any}
    />
  );
}
