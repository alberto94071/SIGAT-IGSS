import { db } from "@/lib/db";
import { usuarios } from "@/lib/schema";
import { requireTabAccess } from "@/lib/modulo-access";
import UsuariosClient from "./UsuariosClient";

export default async function AdministracionPage() {
  const { session, rol } = await requireTabAccess("mod_administracion", "tab_admin_usuarios");

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

  return (
    <UsuariosClient
      usuarios={lista as any}
      rol={rol}
      currentUserId={Number(session.user.id)}
    />
  );
}
