import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getPagosPorPoliza } from "@/lib/pasajes-actions";
import ImprimirPolizaClient from "./ImprimirPolizaClient";

export default async function PolizaImprimirPage({ params }: { params: Promise<{ poliza: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { poliza } = await params;
  const polizaNo = Number(poliza);
  const pagos = await getPagosPorPoliza(polizaNo);
  if (pagos.length === 0) notFound();

  const [config] = await db.select().from(configuracion).limit(1);

  return (
    <ImprimirPolizaClient
      polizaNo={polizaNo}
      pagos={pagos}
      codigoUnidad={config?.codigo_unidad ?? "407"}
      nombreUnidad={config?.nombre_unidad ?? "Consultorio del Instituto en San Marcos / U.I.A.A.D.D.M. en el Municipio de Tejutla"}
    />
  );
}
