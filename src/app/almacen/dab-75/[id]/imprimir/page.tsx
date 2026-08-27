import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRequisicion } from "../../actions";
import ImprimirDab75Client from "./ImprimirDab75Client";

export default async function ImprimirDab75Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const requisicion = await getRequisicion(Number(id));
  if (!requisicion) notFound();

  // El colaborador solo puede imprimir sus propias solicitudes, y solo una
  // vez que el encargado de Almacén las aprobó — antes de eso no hay nada
  // que firmar. El resto de roles (con acceso a mod_almacen) puede seguir
  // entrando como siempre.
  if (session.user.rol === "colaborador") {
    if (requisicion.creado_por !== Number(session.user.id) || requisicion.estado !== "Aprobado") notFound();
  }

  return <ImprimirDab75Client requisicion={requisicion} />;
}
