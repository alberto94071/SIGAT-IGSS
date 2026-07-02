import { NAV_ITEMS, ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Fondo Rotativo es un módulo más — su acceso también se controla por permiso, no es especial.
  const { session, rol, permisos } = await requireModuloAccess("mod_fondo_rotativo");

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
