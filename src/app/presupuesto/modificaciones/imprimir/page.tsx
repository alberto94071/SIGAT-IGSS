import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getModificaciones, getTransferencias } from "@/lib/programacion-actions";
import ImprimirModificacionesClient from "./ImprimirModificacionesClient";

export default async function ImprimirModificacionesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [modificaciones, transferencias, [config]] = await Promise.all([
    getModificaciones(),
    getTransferencias(),
    db.select().from(configuracion).limit(1),
  ]);

  return (
    <ImprimirModificacionesClient
      modificaciones={modificaciones}
      transferencias={transferencias}
      nombreUnidad={config?.nombre_unidad ?? ""}
      nombreEncargado={config?.nombre_encargado_unidad ?? ""}
      cargoEncargado={config?.cargo_encargado_unidad ?? ""}
    />
  );
}
