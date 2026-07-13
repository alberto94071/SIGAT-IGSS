import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getSolicitudPasaje } from "@/lib/pasajes-actions";
import ImprimirSps75Client from "./ImprimirSps75Client";

export default async function Sps75ImprimirPage({ params }: { params: Promise<{ numero: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { numero } = await params;
  const solicitud = await getSolicitudPasaje(Number(numero));
  if (!solicitud) notFound();

  const [config] = await db.select().from(configuracion).limit(1);

  return (
    <ImprimirSps75Client
      solicitud={solicitud}
      nombreUnidad={config?.nombre_dependencia_medica ?? "Consultorio de Tacaná, Departamento de San Marcos"}
      nombreJefe={config?.nombre_encargado_unidad ?? "Lilia Zucely Pérez Fuentes"}
      cargoJefe={config?.cargo_encargado_unidad ?? 'Analista "A"'}
      nombreSolicitante={config?.nombre_secretaria_unidad ?? "Elesinda Gabriela Rodriguez Orozco"}
      cargoSolicitante={config?.cargo_secretaria_unidad ?? 'Secretaria "A"'}
    />
  );
}
