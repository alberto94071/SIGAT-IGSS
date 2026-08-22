import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

const COMPRAS_NAV = [
  { href: "/compras/catalogo",      label: "Catálogo",      icon: "BookOpen",     permiso: "tab_compras_catalogo"      },
  { href: "/compras/a01-siaf",      label: "A-01 SIAF",     icon: "FileText",     permiso: "tab_compras_a01siaf"       },
  { href: "/compras/consolidacion", label: "Consolidación", icon: "Layers",       permiso: "tab_compras_consolidacion" },
  { href: "/compras/adjudicacion",  label: "Adjudicación",  icon: "Gavel",        permiso: "tab_compras_adjudicacion"  },
  { href: "/compras/ordenes",       label: "Órdenes",       icon: "ShoppingCart", permiso: "tab_compras_ordenes"       },
  { href: "/compras/archivo",       label: "Archivo",       icon: "Archive",      permiso: "tab_compras_archivo"       },
] as const;

export default async function ComprasLayout({ children }: { children: React.ReactNode }) {
  const { session, rol, permisos } = await requireModuloAccess("mod_compras");
  const navItems = COMPRAS_NAV.filter(item => permisos[item.permiso]);

  return (
    <DashboardShell
      navItems={navItems}
      user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS[rol]}
      rolColor={ROL_COLORS[rol]}
      moduleLabel="Compras"
    >
      {children}
    </DashboardShell>
  );
}
