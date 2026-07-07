import { notFound } from "next/navigation";
import { getRequisicion } from "../../actions";
import ImprimirDab75Client from "./ImprimirDab75Client";

export default async function ImprimirDab75Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requisicion = await getRequisicion(Number(id));
  if (!requisicion) notFound();
  return <ImprimirDab75Client requisicion={requisicion} />;
}
