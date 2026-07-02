import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

const ADMINISTRACION_NAV = [
  { href: "/administracion", label: "Usuarios y Permisos", icon: "Users" },
] as const;

export default async function AdministracionLayout({ children }: { children: React.ReactNode }) {
  const { session, rol } = await requireModuloAccess("mod_administracion");

  return (
    <DashboardShell
      navItems={ADMINISTRACION_NAV}
      user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS[rol]}
      rolColor={ROL_COLORS[rol]}
      moduleLabel="Administración"
    >
      {children}
    </DashboardShell>
  );
}
