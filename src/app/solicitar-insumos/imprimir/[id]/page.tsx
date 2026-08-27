import { notFound } from "next/navigation";
import { requireColaborador } from "@/lib/modulo-access";
import { getRequisicion } from "@/app/almacen/dab-75/actions";
import ImprimirDab75Client from "@/app/almacen/dab-75/[id]/imprimir/ImprimirDab75Client";

// Ruta de impresión propia para el colaborador — la de almacen/dab-75/[id]/imprimir
// vive bajo almacen/layout.tsx, que exige mod_almacen (el colaborador nunca
// lo tiene), así que nunca llegaría ahí. Reutiliza el mismo componente de
// impresión y la misma acción de datos, solo con su propio gate: la
// solicitud tiene que ser suya y estar Aprobada.
export default async function ImprimirMiSolicitudPage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requireColaborador();
  const { id } = await params;

  const requisicion = await getRequisicion(Number(id));
  if (!requisicion) notFound();
  if (requisicion.creado_por !== Number(session.user.id) || requisicion.estado !== "Aprobado") notFound();

  return <ImprimirDab75Client requisicion={requisicion} />;
}
