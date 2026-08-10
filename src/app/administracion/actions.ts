"use server";
import { db } from "@/lib/db";
import { usuarios, auditLog } from "@/lib/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { type Rol, type Permisos, ROLES_GESTIONABLES_POR_ADMIN } from "@/lib/permisos";

async function getMe() {
  const session = await auth();
  return session ? { id: Number(session.user.id), rol: session.user.rol as Rol } : null;
}

async function getRolDe(id: number): Promise<Rol | null> {
  const [row] = await db.select({ rol: usuarios.rol }).from(usuarios).where(eq(usuarios.id, id)).limit(1);
  return (row?.rol as Rol) ?? null;
}

// Un "admin" solo puede tocar cuentas operador/consulta, y solo puede dejar
// el rol resultante en operador/consulta (nunca ascender a admin/superadmin
// ni tocar una cuenta que ya es admin/superadmin).
function puedeGestionarUsuarios(me: { rol: Rol }): boolean {
  return me.rol === "superadmin" || me.rol === "admin";
}

export async function crearUsuario(data: {
  nombre: string; email: string; password: string; rol: Rol;
}) {
  try {
    const me = await getMe();
    if (!me || !puedeGestionarUsuarios(me)) return { error: "Sin permiso" };
    if (me.rol === "admin" && !ROLES_GESTIONABLES_POR_ADMIN.includes(data.rol)) {
      return { error: "Solo el Administrador Máster puede crear administradores" };
    }

    const hash = await bcrypt.hash(data.password, 12);
    const [nuevo] = await db.insert(usuarios).values({
      nombre:       data.nombre,
      email:        data.email,
      password_hash:hash,
      rol:          data.rol,
      permisos:     "{}",
    }).returning();

    await db.insert(auditLog).values({
      usuario_id: me.id,
      accion:     "crear_usuario",
      tabla:      "usuarios",
      registro_id:nuevo.id,
      detalle:    `Creó usuario ${data.email} con rol ${data.rol}`,
    });

    return { usuario: nuevo };
  } catch (e: any) {
    if (e.message?.includes("unique")) return { error: "El correo ya está registrado" };
    return { error: "Error al crear el usuario" };
  }
}

export async function editarUsuario(data: {
  id: number; nombre: string; email: string; rol: Rol;
}) {
  try {
    const me = await getMe();
    if (!me || !puedeGestionarUsuarios(me)) return { error: "Sin permiso" };
    if (me.rol === "admin") {
      const rolActual = await getRolDe(data.id);
      if (!rolActual || !ROLES_GESTIONABLES_POR_ADMIN.includes(rolActual)) return { error: "Sin permiso" };
      if (!ROLES_GESTIONABLES_POR_ADMIN.includes(data.rol)) {
        return { error: "Solo el Administrador Máster puede asignar el rol de administrador" };
      }
    }

    await db.update(usuarios)
      .set({ nombre: data.nombre, email: data.email, rol: data.rol, updated_at: new Date().toISOString() })
      .where(eq(usuarios.id, data.id));

    await db.insert(auditLog).values({
      usuario_id: me.id,
      accion:     "editar_usuario",
      tabla:      "usuarios",
      registro_id:data.id,
      detalle:    `Editó usuario id=${data.id}`,
    });

    return { ok: true };
  } catch {
    return { error: "Error al editar el usuario" };
  }
}

export async function resetPassword(data: { id: number; password: string }) {
  try {
    const me = await getMe();
    if (!me || !puedeGestionarUsuarios(me)) return { error: "Sin permiso" };
    if (me.rol === "admin") {
      const rolActual = await getRolDe(data.id);
      if (!rolActual || !ROLES_GESTIONABLES_POR_ADMIN.includes(rolActual)) return { error: "Sin permiso" };
    }
    if (data.password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };

    const hash = await bcrypt.hash(data.password, 12);
    await db.update(usuarios)
      .set({ password_hash: hash, updated_at: new Date().toISOString() })
      .where(eq(usuarios.id, data.id));

    await db.insert(auditLog).values({
      usuario_id: me.id,
      accion:     "reset_password",
      tabla:      "usuarios",
      registro_id:data.id,
      detalle:    `Restableció contraseña del usuario id=${data.id}`,
    });

    return { ok: true };
  } catch {
    return { error: "Error al restablecer la contraseña" };
  }
}

export async function toggleActivo(data: { id: number; activo: boolean }) {
  try {
    const me = await getMe();
    if (!me || !puedeGestionarUsuarios(me)) return { error: "Sin permiso" };
    if (me.rol === "admin") {
      const rolActual = await getRolDe(data.id);
      if (!rolActual || !ROLES_GESTIONABLES_POR_ADMIN.includes(rolActual)) return { error: "Sin permiso" };
    }

    await db.update(usuarios)
      .set({ activo: data.activo, updated_at: new Date().toISOString() })
      .where(eq(usuarios.id, data.id));

    await db.insert(auditLog).values({
      usuario_id: me.id,
      accion:     data.activo ? "habilitar_usuario" : "deshabilitar_usuario",
      tabla:      "usuarios",
      registro_id:data.id,
      detalle:    `${data.activo ? "Habilitó" : "Deshabilitó"} usuario id=${data.id}`,
    });

    return { ok: true };
  } catch {
    return { error: "Error al cambiar el estado" };
  }
}

// Los "accesos" (permisos por módulo) son configuración del Administrador
// Máster — un admin no los toca, aunque sí pueda crear/editar usuarios.
export async function guardarPermisos(data: { id: number; permisos: Permisos }) {
  try {
    const me = await getMe();
    if (!me || me.rol !== "superadmin") return { error: "Sin permiso" };

    await db.update(usuarios)
      .set({ permisos: JSON.stringify(data.permisos), updated_at: new Date().toISOString() })
      .where(eq(usuarios.id, data.id));

    await db.insert(auditLog).values({
      usuario_id: me.id,
      accion:     "editar_permisos",
      tabla:      "usuarios",
      registro_id:data.id,
      detalle:    `Actualizó permisos del usuario id=${data.id}`,
    });

    return { ok: true };
  } catch {
    return { error: "Error al guardar permisos" };
  }
}
