import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

const ALMACEN_NAV = [
  { href: "/almacen/catalogo",   label: "Catálogo",   icon: "BookOpen",   permiso: "tab_almacen_catalogo"   },
  { href: "/almacen/dab-60",     label: "DAB-60",     icon: "FileText",   permiso: "tab_almacen_dab60"      },
  { href: "/almacen/dab-75",     label: "DAB-75",     icon: "FileText",   permiso: "tab_almacen_dab75"      },
  { href: "/almacen/cuadricula", label: "Cuadrícula", icon: "LayoutGrid", permiso: "tab_almacen_cuadricula" },
  { href: "/almacen/archivo",    label: "Archivo",    icon: "Archive",    permiso: "tab_almacen_archivo"    },
] as const;

export default async function AlmacenLayout({ children }: { children: React.ReactNode }) {
  const { session, rol, permisos } = await requireModuloAccess("mod_almacen");
  const navItems = ALMACEN_NAV.filter(item => permisos[item.permiso]);

  return (
    <DashboardShell
      navItems={navItems}
      user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS[rol]}
      rolColor={ROL_COLORS[rol]}
      moduleLabel="Almacén"
    >
      {children}
    </DashboardShell>
  );
}
