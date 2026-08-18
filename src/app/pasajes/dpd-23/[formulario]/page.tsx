import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { getPagoPasaje } from "@/lib/pasajes-actions";
import ImprimirDpd23Client from "./ImprimirDpd23Client";

export default async function Dpd23ImprimirPage({ params }: { params: Promise<{ formulario: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { formulario } = await params;
  const formularioNo = Number(formulario);
  const pago = await getPagoPasaje(formularioNo);
  if (!pago) notFound();

  const [config, firmantes] = await Promise.all([
    db.select().from(configuracion).limit(1).then(r => r[0]),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  return (
    <ImprimirDpd23Client
      pago={pago}
      codigoContable={config?.codigo_contable ?? "12.07.04"}
      nombreUnidad={config?.nombre_dependencia_medica ?? "Consultorio de Tacaná, Departamento de San Marcos"}
      municipio={config?.municipio ?? "Tacaná, San Marcos"}
      nombreSecretaria={config?.nombre_secretaria_unidad ?? "Elesinda Gabriela Rodriguez Orozco"}
      cargoSecretaria={config?.cargo_secretaria_unidad ?? 'Secretaria "A"'}
      firmantes={firmantes as any}
    />
  );
}
