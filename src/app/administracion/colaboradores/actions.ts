"use server";
import { db } from "@/lib/db";
import { usuarios, auditLog } from "@/lib/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { type Rol } from "@/lib/permisos";

async function getMe() {
  const session = await auth();
  return session ? { id: Number(session.user.id), rol: session.user.rol as Rol } : null;
}

// Mismo criterio que administracion/actions.ts: superadmin y admin pueden
// gestionar el día a día del personal operativo (acá, colaboradores).
function puedeGestionarUsuarios(me: { rol: Rol }): boolean {
  return me.rol === "superadmin" || me.rol === "admin";
}

export type Colaborador = {
  id: number; nombre: string; ibm: string | null; puesto_nominal: string | null; activo: boolean;
  nit: string | null; salario: number | null; grupo: string | null; categoria_puesto: string | null;
};

export async function getColaboradores(): Promise<Colaborador[]> {
  const me = await getMe();
  if (!me || !puedeGestionarUsuarios(me)) return [];
  return db.select({
    id: usuarios.id, nombre: usuarios.nombre, ibm: usuarios.ibm,
    puesto_nominal: usuarios.puesto_nominal, activo: usuarios.activo,
    nit: usuarios.nit, salario: usuarios.salario, grupo: usuarios.grupo, categoria_puesto: usuarios.categoria_puesto,
  }).from(usuarios).where(eq(usuarios.rol, "colaborador")).orderBy(usuarios.nombre);
}

// nit/salario/grupo/categoria_puesto son opcionales (solo hacen falta para
// Viáticos — un colaborador que solo pide insumos puede no tenerlos nunca).
export type DatosViaticoColaborador = {
  nit?: string; salario?: number | null; grupo?: string; categoria_puesto?: string;
};

export async function crearColaborador(data: {
  nombre: string; ibm: string; puesto_nominal: string; password: string;
} & DatosViaticoColaborador): Promise<{ colaborador: Colaborador } | { error: string }> {
  try {
    const me = await getMe();
    if (!me || !puedeGestionarUsuarios(me)) return { error: "Sin permiso" };
    if (!data.nombre.trim() || !data.ibm.trim() || !data.puesto_nominal.trim()) {
      return { error: "Nombre, IBM y puesto nominal son obligatorios" };
    }
    if (data.password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };

    const hash = await bcrypt.hash(data.password, 12);
    const [nuevo] = await db.insert(usuarios).values({
      nombre:         data.nombre.trim(),
      ibm:            data.ibm.trim(),
      puesto_nominal: data.puesto_nominal.trim(),
      email:          null,
      password_hash:  hash,
      rol:            "colaborador",
      permisos:       "{}",
      nit:              data.nit?.trim() || null,
      salario:          data.salario ?? null,
      grupo:            data.grupo?.trim() || null,
      categoria_puesto: data.categoria_puesto?.trim() || null,
    }).returning();

    await db.insert(auditLog).values({
      usuario_id: me.id,
      accion:     "crear_colaborador",
      tabla:      "usuarios",
      registro_id:nuevo.id,
      detalle:    `Creó colaborador ${data.nombre} (IBM ${data.ibm})`,
    });

    return { colaborador: {
      id: nuevo.id, nombre: nuevo.nombre, ibm: nuevo.ibm, puesto_nominal: nuevo.puesto_nominal, activo: nuevo.activo,
      nit: nuevo.nit, salario: nuevo.salario, grupo: nuevo.grupo, categoria_puesto: nuevo.categoria_puesto,
    } };
  } catch (e: any) {
    if (e.message?.includes("unique")) return { error: "Ese IBM ya está registrado" };
    return { error: "Error al crear el colaborador" };
  }
}

export async function editarColaborador(data: {
  id: number; nombre: string; ibm: string; puesto_nominal: string;
} & DatosViaticoColaborador): Promise<{ ok: true } | { error: string }> {
  try {
    const me = await getMe();
    if (!me || !puedeGestionarUsuarios(me)) return { error: "Sin permiso" };
    if (!data.nombre.trim() || !data.ibm.trim() || !data.puesto_nominal.trim()) {
      return { error: "Nombre, IBM y puesto nominal son obligatorios" };
    }

    await db.update(usuarios)
      .set({
        nombre: data.nombre.trim(), ibm: data.ibm.trim(), puesto_nominal: data.puesto_nominal.trim(),
        nit:              data.nit?.trim() || null,
        salario:          data.salario ?? null,
        grupo:            data.grupo?.trim() || null,
        categoria_puesto: data.categoria_puesto?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .where(eq(usuarios.id, data.id));

    await db.insert(auditLog).values({
      usuario_id: me.id,
      accion:     "editar_colaborador",
      tabla:      "usuarios",
      registro_id:data.id,
      detalle:    `Editó colaborador id=${data.id}`,
    });

    return { ok: true };
  } catch (e: any) {
    if (e.message?.includes("unique")) return { error: "Ese IBM ya está registrado" };
    return { error: "Error al editar el colaborador" };
  }
}
