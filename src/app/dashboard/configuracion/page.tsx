import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { redirect } from "next/navigation";
import { parsePermisos, type Rol } from "@/lib/permisos";
import ConfiguracionClient from "./ConfiguracionClient";

export default async function ConfiguracionPage() {
  const session = await auth();
  const rol = session!.user.rol as Rol;
  const permisos = parsePermisos(session!.user.permisos, rol);
  if (!permisos.configuracion) redirect("/dashboard");

  const [config] = await db.select().from(configuracion).limit(1);
  return <ConfiguracionClient config={config} />;
}
