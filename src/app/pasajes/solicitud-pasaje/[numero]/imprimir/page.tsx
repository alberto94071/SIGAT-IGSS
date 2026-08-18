import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { getSolicitudPasaje } from "@/lib/pasajes-actions";
import ImprimirSps75Client from "./ImprimirSps75Client";

export default async function Sps75ImprimirPage({ params }: { params: Promise<{ numero: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { numero } = await params;
  const solicitud = await getSolicitudPasaje(Number(numero));
  if (!solicitud) notFound();

  const [config, firmantes] = await Promise.all([
    db.select().from(configuracion).limit(1).then(r => r[0]),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  return (
    <ImprimirSps75Client
      solicitud={solicitud}
      nombreUnidad={config?.nombre_dependencia_medica ?? "Consultorio de Tacaná, Departamento de San Marcos"}
      nombreSolicitante={config?.nombre_secretaria_unidad ?? "Elesinda Gabriela Rodriguez Orozco"}
      cargoSolicitante={config?.cargo_secretaria_unidad ?? 'Secretaria "A"'}
      firmantes={firmantes as any}
    />
  );
}
