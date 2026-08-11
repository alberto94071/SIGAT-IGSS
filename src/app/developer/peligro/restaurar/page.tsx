import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DeveloperRestoreClient from "./DeveloperRestoreClient";

// Zona de desarrollador — antes solo dependía de una clave hardcodeada en el
// código fuente (visible para siempre en el repositorio), lo que dejaba esta
// página alcanzable por cualquier cuenta con sesión. Ahora también exige
// Administrador Máster antes de mostrar siquiera el formulario; la clave
// sigue pidiéndose como paso adicional, pero el rol es la barrera real (ver
// también restaurarBackup en src/lib/developer/backup-actions.ts).
export default async function DeveloperRestorePage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.rol !== "superadmin") redirect("/launcher");
  return <DeveloperRestoreClient />;
}
