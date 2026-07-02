import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

const CONFIGURACION_NAV = [
  { href: "/configuracion", label: "Configuración General", icon: "Settings" },
] as const;

export default async function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const { session, rol } = await requireModuloAccess("mod_configuracion");

  return (
    <DashboardShell
      navItems={CONFIGURACION_NAV}
      user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS[rol]}
      rolColor={ROL_COLORS[rol]}
      moduleLabel="Configuración"
    >
      {children}
    </DashboardShell>
  );
}
