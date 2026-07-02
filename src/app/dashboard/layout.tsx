import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NAV_ITEMS, ROL_LABELS, ROL_COLORS, type Rol } from "@/lib/permisos";
import { getPermisosFrescos } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const rol = session.user.rol as Rol;
  // Se leen frescos de la base (no del JWT) para que un cambio del superadmin aplique al instante.
  const permisos = await getPermisosFrescos(Number(session.user.id), rol);

  const navItems = NAV_ITEMS.filter(item =>
    item.permiso === null || permisos[item.permiso as keyof typeof permisos]
  );

  return (
    <DashboardShell
      navItems={navItems}
      user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS[rol]}
      rolColor={ROL_COLORS[rol]}
      moduleLabel="Fondo Rotativo"
    >
      {children}
    </DashboardShell>
  );
}
