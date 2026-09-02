import { notFound } from "next/navigation";
import { requireColaborador } from "@/lib/modulo-access";
import { getSolicitudParaImprimir } from "@/app/viaticos/registro-comision/actions";
import ImprimirVAClient from "@/app/viaticos/entrega-formulario/[id]/imprimir/va/ImprimirVAClient";

export default async function ImprimirMiVAPage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requireColaborador();
  const { id } = await params;

  const solicitud = await getSolicitudParaImprimir(Number(id));
  if (!solicitud) notFound();
  if (solicitud.colaborador_id !== Number(session.user.id) || solicitud.estado !== "Aprobado") notFound();

  return <ImprimirVAClient numeroFormulario={solicitud.numero_formulario} />;
}
