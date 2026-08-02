import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { parsePermisos, type Rol, type Modulo, type Permisos } from "@/lib/permisos";

export async function getPermisosFrescos(userId: number, rol: Rol): Promise<Permisos> {
  const [row] = await db.select({ permisos: usuarios.permisos }).from(usuarios)
    .where(eq(usuarios.id, userId)).limit(1);
  return parsePermisos(row?.permisos ?? "{}", rol);
}

export async function requireModuloAccess(modulo: Modulo) {
  const session = await auth();
  if (!session) redirect("/login");
  const rol = session.user.rol as Rol;
  const permisos = await getPermisosFrescos(Number(session.user.id), rol);
  if (!permisos[modulo]) redirect("/launcher");
  return { session, rol, permisos };
}

// Igual que requireModuloAccess, pero para usarse DENTRO de una server
// action (donde un redirect no es apropiado): devuelve {error}/{uid} en vez
// de redirigir. Se usa para las acciones de "Aprobar"/"Rechazar" que solo
// puede tomar quien tenga acceso al módulo correspondiente (ej.
// mod_presupuesto), independientemente de si el usuario tiene permiso
// general de edición.
export async function requireModuloAccessAction(modulo: Modulo): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  const rol = session.user.rol as Rol;
  const permisos = await getPermisosFrescos(Number(session.user.id), rol);
  if (!permisos[modulo]) return { error: "No tienes acceso al módulo requerido para esta acción" };
  return { uid: Number(session.user.id) };
}
