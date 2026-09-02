import { notFound } from "next/navigation";
import { requireColaborador } from "@/lib/modulo-access";
import { getSolicitud, getUsuariosParaFirmante, getPreciosServicios } from "../actions";
import DetalleViaticoClient from "./DetalleViaticoClient";

export default async function DetalleViaticoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireColaborador();
  const { id } = await params;

  const solicitud = await getSolicitud(Number(id));
  if (!solicitud) notFound();
  if (!["Habilitado", "Enviado"].includes(solicitud.estado)) notFound();

  const [firmantes, precios] = await Promise.all([getUsuariosParaFirmante(), getPreciosServicios()]);
  return <DetalleViaticoClient solicitud={solicitud} firmantes={firmantes} precios={precios} />;
}
