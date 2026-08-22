import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

const VIATICOS_NAV = [
  { href: "/viaticos/entrega-formulario", label: "Entrega de Formulario", icon: "FileText", permiso: "tab_viaticos_entrega"  },
  { href: "/viaticos/registro-comision",  label: "Registro de Comisión", icon: "MapPin",    permiso: "tab_viaticos_comision" },
] as const;

export default async function ViaticosLayout({ children }: { children: React.ReactNode }) {
  const { session, rol, permisos } = await requireModuloAccess("mod_viaticos");
  const navItems = VIATICOS_NAV.filter(item => permisos[item.permiso]);

  return (
    <DashboardShell
      navItems={navItems}
      user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS[rol]}
      rolColor={ROL_COLORS[rol]}
      moduleLabel="Pago de Viáticos"
    >
      {children}
    </DashboardShell>
  );
}
