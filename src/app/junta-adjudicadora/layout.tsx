import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

const JUNTA_ADJUDICADORA_NAV = [
  { href: "/junta-adjudicadora/adjudicacion", label: "Adjudicación", icon: "Gavel",    permiso: "tab_junta_adjudicacion" },
  { href: "/junta-adjudicadora/acta",         label: "Acta",         icon: "FileText", permiso: "tab_junta_acta"         },
  { href: "/junta-adjudicadora/historial",    label: "Historial",    icon: "Archive",  permiso: "tab_junta_historial"    },
] as const;

export default async function JuntaAdjudicadoraLayout({ children }: { children: React.ReactNode }) {
  const { session, rol, permisos } = await requireModuloAccess("mod_junta_adjudicadora");
  const navItems = JUNTA_ADJUDICADORA_NAV.filter(item => permisos[item.permiso]);

  return (
    <DashboardShell
      navItems={navItems}
      user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS[rol]}
      rolColor={ROL_COLORS[rol]}
      moduleLabel="Junta Adjudicadora"
    >
      {children}
    </DashboardShell>
  );
}
