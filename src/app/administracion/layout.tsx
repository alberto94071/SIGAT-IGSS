import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

const ADMINISTRACION_NAV = [
  { href: "/administracion",               label: "Usuarios y Permisos",   icon: "Users",    permiso: "tab_admin_usuarios"      },
  { href: "/administracion/configuracion", label: "Configuración General", icon: "Settings", permiso: "tab_admin_configuracion" },
] as const;

// Solo el Administrador Máster (superadmin) ve la opción de reinicio — el
// resto de roles ni siquiera sabe que existe. No es delegable por permiso.
const REINICIAR_NAV = { href: "/administracion/reiniciar", label: "Reiniciar Sistema", icon: "RotateCcw" } as const;

export default async function AdministracionLayout({ children }: { children: React.ReactNode }) {
  const { session, rol, permisos } = await requireModuloAccess("mod_administracion");
  const navBase = ADMINISTRACION_NAV.filter(item => permisos[item.permiso]);
  const navItems = rol === "superadmin" ? [...navBase, REINICIAR_NAV] : navBase;

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
