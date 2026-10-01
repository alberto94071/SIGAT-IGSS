import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";
import { REPORTES_GRUPOS } from "./reportes-config";

export default async function ReportesLayout({ children }: { children: React.ReactNode }) {
  const { session, rol, permisos } = await requireModuloAccess("mod_reportes");

  const navGroups = REPORTES_GRUPOS.map(g => ({
    id: g.id,
    label: g.label,
    icon: g.icon,
    items: g.reportes.filter(r => permisos[r.permiso]).map(r => ({ href: r.href, label: r.label, icon: "" })),
  }));

  return (
    <DashboardShell
      navGroups={navGroups}
      user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS[rol]}
      rolColor={ROL_COLORS[rol]}
      moduleLabel="Reportes"
    >
      {children}
    </DashboardShell>
  );
}
