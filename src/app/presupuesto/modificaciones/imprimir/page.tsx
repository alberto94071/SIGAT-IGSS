import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { getModificaciones, getTransferencias } from "@/lib/programacion-actions";
import ImprimirModificacionesClient from "./ImprimirModificacionesClient";

export default async function ImprimirModificacionesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [modificaciones, transferencias, [config], firmantes] = await Promise.all([
    getModificaciones(),
    getTransferencias(),
    db.select().from(configuracion).limit(1),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  return (
    <ImprimirModificacionesClient
      modificaciones={modificaciones.filter(m => m.estado === "Aprobado")}
      transferencias={transferencias.filter(t => t.estado === "Aprobado")}
      nombreUnidad={config?.nombre_unidad ?? ""}
      firmantes={firmantes as any}
    />
  );
}
