import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getPagoPasaje } from "@/lib/pasajes-actions";
import ImprimirDpd23Client from "./ImprimirDpd23Client";

export default async function Dpd23ImprimirPage({ params }: { params: Promise<{ formulario: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { formulario } = await params;
  const formularioNo = Number(formulario);
  const pago = await getPagoPasaje(formularioNo);
  if (!pago) notFound();

  const [config] = await db.select().from(configuracion).limit(1);

  return (
    <ImprimirDpd23Client
      pago={pago}
      codigoContable={config?.codigo_contable ?? "12.07.04"}
      nombreUnidad={config?.nombre_dependencia_medica ?? "Consultorio de Tacaná, Departamento de San Marcos"}
      municipio={config?.municipio ?? "Tacaná, San Marcos"}
      nombreSecretaria={config?.nombre_secretaria_unidad ?? "Elesinda Gabriela Rodriguez Orozco"}
      cargoSecretaria={config?.cargo_secretaria_unidad ?? 'Secretaria "A"'}
      nombreEncargado={config?.nombre_encargado_unidad ?? "Lilia Zucely Pérez Fuentes"}
      cargoEncargado={config?.cargo_encargado_unidad ?? 'Analista "A"'}
    />
  );
}
