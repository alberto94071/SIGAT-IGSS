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
      nombreUnidad={config?.nombre_dependencia_medica ?? "Unidad Integral de Adscripción, Acreditación de Derechos y Despacho de Medicamentos, en el Municipio de Tejutla"}
    />
  );
}
