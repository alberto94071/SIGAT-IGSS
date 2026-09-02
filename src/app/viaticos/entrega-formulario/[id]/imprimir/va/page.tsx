import { notFound } from "next/navigation";
import { requireTabAccess } from "@/lib/modulo-access";
import { getSolicitudParaImprimir } from "../../../../registro-comision/actions";
import ImprimirVAClient from "./ImprimirVAClient";

export default async function ImprimirVAPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTabAccess("mod_viaticos", "tab_viaticos_entrega");
  const { id } = await params;

  const solicitud = await getSolicitudParaImprimir(Number(id));
  if (!solicitud) notFound();
  if (solicitud.estado !== "Aprobado") notFound();

  return <ImprimirVAClient numeroFormulario={solicitud.numero_formulario} />;
}
