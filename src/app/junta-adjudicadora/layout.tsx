import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

const JUNTA_ADJUDICADORA_NAV = [
  { href: "/junta-adjudicadora/adjudicacion", label: "Adjudicación", icon: "Gavel"    },
  { href: "/junta-adjudicadora/acta",         label: "Acta",         icon: "FileText" },
  { href: "/junta-adjudicadora/historial",    label: "Historial",    icon: "Archive"  },
] as const;

export default async function JuntaAdjudicadoraLayout({ children }: { children: React.ReactNode }) {
  const { session, rol } = await requireModuloAccess("mod_junta_adjudicadora");

  return (
    <DashboardShell
      navItems={JUNTA_ADJUDICADORA_NAV}
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
