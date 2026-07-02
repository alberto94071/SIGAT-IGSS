"use server";
import { db } from "@/lib/db";
import { usuarios, auditLog } from "@/lib/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { type Rol, type Permisos } from "@/lib/permisos";

async function getMe() {
  const session = await auth();
  return session ? { id: Number(session.user.id), rol: session.user.rol as Rol } : null;
}

export async function crearUsuario(data: {
  nombre: string; email: string; password: string; rol: Rol;
}) {
  try {
    const me = await getMe();
    if (!me || me.rol !== "superadmin") return { error: "Sin permiso" };

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
    if (!me || me.rol !== "superadmin") return { error: "Sin permiso" };

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
    if (!me || me.rol !== "superadmin") return { error: "Sin permiso" };
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
    if (!me || me.rol !== "superadmin") return { error: "Sin permiso" };

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
