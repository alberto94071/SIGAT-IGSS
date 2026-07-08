import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getPolizaPorNumero } from "@/lib/poliza-actions";
import ImprimirPolizaClient from "./ImprimirPolizaClient";

export default async function PolizaImprimirPage({ params }: { params: Promise<{ numero: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { numero } = await params;
  const res = await getPolizaPorNumero(Number(numero));
  if (!res) notFound();

  const [config] = await db.select().from(configuracion).limit(1);

  return (
    <ImprimirPolizaClient
      poliza={res.poliza}
      items={res.items}
      codigoContable={config?.codigo_contable ?? "12.10.09"}
      nombreUnidad={config?.nombre_unidad ?? "Consultorio del Instituto en San Marcos / U.I.A.A.D.D.M. en el Municipio de Tejutla"}
      nombreEncargado={config?.nombre_encargado_unidad ?? "Lilia Zucely Pérez Fuentes"}
      cargoEncargado={config?.cargo_encargado_unidad ?? 'Analista "A"'}
    />
  );
}
