import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/schema";
import { type Rol } from "@/lib/permisos";
import { getPermisosFrescos } from "@/lib/modulo-access";
import { redirect } from "next/navigation";
import UsuariosClient from "./UsuariosClient";

export default async function UsuariosPage() {
  const session = await auth();
  const rol     = session!.user.rol as Rol;
  const permisos = await getPermisosFrescos(Number(session!.user.id), rol);

  if (!permisos.usuarios) redirect("/dashboard");

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
      currentUserId={Number(session!.user.id)}
    />
  );
}
