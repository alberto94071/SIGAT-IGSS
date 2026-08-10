import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

const ADMINISTRACION_NAV = [
  { href: "/administracion",               label: "Usuarios y Permisos",   icon: "Users" },
  { href: "/administracion/configuracion", label: "Configuración General", icon: "Settings" },
] as const;

// Solo el Administrador Máster (superadmin) ve la opción de reinicio — el
// resto de roles ni siquiera sabe que existe.
const REINICIAR_NAV = { href: "/administracion/reiniciar", label: "Reiniciar Sistema", icon: "RotateCcw" } as const;

export default async function AdministracionLayout({ children }: { children: React.ReactNode }) {
  const { session, rol } = await requireModuloAccess("mod_administracion");
  const navItems = rol === "superadmin" ? [...ADMINISTRACION_NAV, REINICIAR_NAV] : ADMINISTRACION_NAV;

  return (
    <DashboardShell
      navItems={navItems}
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
