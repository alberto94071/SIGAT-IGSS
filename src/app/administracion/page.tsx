import { db } from "@/lib/db";
import { usuarios } from "@/lib/schema";
import { requireModuloAccess } from "@/lib/modulo-access";
import UsuariosClient from "./UsuariosClient";

export default async function AdministracionPage() {
  const { session, rol } = await requireModuloAccess("mod_administracion");

  const lista = await db
    .select({
      id:         usuarios.id,
      nombre:     usuarios.nombre,
      email:      usuarios.email,
      rol:        usuarios.rol,
      activo:     usuarios.activo,
      permisos:   usuarios.permisos,
      last_login: usuarios.last_login,
      created_at: usuarios.created_at,
    })
    .from(usuarios)
    .orderBy(usuarios.id);

  const isSuperAdmin = rol === "superadmin";

  return (
    <UsuariosClient
      usuarios={lista as any}
      isSuperAdmin={isSuperAdmin}
      currentUserId={Number(session.user.id)}
    />
  );
}
