import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { parsePermisos, NAV_ITEMS, ROL_LABELS, ROL_COLORS, type Rol } from "@/lib/permisos";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const rol = session.user.rol as Rol;
  const permisos = parsePermisos(session.user.permisos, rol);

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
    >
      {children}
    </DashboardShell>
  );
}
