import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

const ALMACEN_NAV = [
  { href: "/almacen/catalogo",   label: "Catálogo",   icon: "BookOpen"   },
  { href: "/almacen/dab-60",     label: "DAB-60",     icon: "FileText"   },
  { href: "/almacen/dab-75",     label: "DAB-75",     icon: "FileText"   },
  { href: "/almacen/cuadricula", label: "Cuadrícula", icon: "LayoutGrid" },
] as const;

export default async function AlmacenLayout({ children }: { children: React.ReactNode }) {
  const { session, rol } = await requireModuloAccess("mod_almacen");

  return (
    <DashboardShell
      navItems={ALMACEN_NAV}
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
