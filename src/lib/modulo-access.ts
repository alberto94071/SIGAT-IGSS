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

// Guard para las rutas de solicitar-insumos/ — el rol "colaborador" no pasa
// por el sistema mod_*/tab_* en absoluto (ver comentario en permisos.ts),
// así que se protege por rol directo en vez de requireModuloAccess.
export async function requireColaborador() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.rol !== "colaborador") redirect("/launcher");
  return { session };
}

export async function requireModuloAccess(modulo: Modulo) {
  const session = await auth();
  if (!session) redirect("/login");
  const rol = session.user.rol as Rol;
  const permisos = await getPermisosFrescos(Number(session.user.id), rol);
  if (!permisos[modulo]) redirect("/launcher");
  return { session, rol, permisos };
}

// Igual que requireModuloAccess, pero además exige una pestaña específica del
// módulo (ej. "tab_presupuesto_modif_ingru") — para el propio page.tsx de
// cada pestaña, no solo para ocultarla del nav. Sin esto, ocultar una
// pestaña del menú lateral no impedía entrar directo por URL. `volverA` es
// a dónde mandar a alguien que sí tiene el módulo pero no esa pestaña
// puntual (por defecto, al índice del módulo).
export async function requireTabAccess(modulo: Modulo, tab: keyof Permisos, volverA?: string) {
  const result = await requireModuloAccess(modulo);
  if (!result.permisos[tab]) redirect(volverA ?? "/launcher");
  return result;
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

// Igual que requireModuloAccessAction, pero además exige una pestaña
// específica (ej. la de "Autorizar") — para acciones de aprobar/rechazar que
// deben quedar limitadas a quien tenga ese permiso puntual, no a cualquiera
// con acceso al módulo completo.
export async function requireTabAccessAction(modulo: Modulo, tab: keyof Permisos): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  const rol = session.user.rol as Rol;
  const permisos = await getPermisosFrescos(Number(session.user.id), rol);
  if (!permisos[modulo]) return { error: "No tienes acceso al módulo requerido para esta acción" };
  if (!permisos[tab]) return { error: "No tienes permiso para autorizar en este submódulo" };
  return { uid: Number(session.user.id) };
}
