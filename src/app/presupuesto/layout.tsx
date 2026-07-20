import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

const PRESUPUESTO_NAV = [
  { href: "/presupuesto/general",                label: "General",                            icon: "Calculator"    },
  { href: "/presupuesto/compromiso",             label: "Compromiso",                         icon: "FileCheck"     },
  { href: "/presupuesto/devengado",              label: "Devengado",                          icon: "FileCheck"     },
  { href: "/presupuesto/programacion",           label: "Programación y Reprogramación",      icon: "BarChart3"     },
  { href: "/presupuesto/modificaciones",         label: "Modificaciones",                     icon: "FileSignature" },
  { href: "/presupuesto/ejecucion",              label: "Ejecución",                          icon: "BookOpen"      },
] as const;

export default async function PresupuestoLayout({ children }: { children: React.ReactNode }) {
  const { session, rol } = await requireModuloAccess("mod_presupuesto");

  return (
    <DashboardShell
      navItems={PRESUPUESTO_NAV}
      user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS[rol]}
      rolColor={ROL_COLORS[rol]}
      moduleLabel="Presupuesto"
    >
      {children}
    </DashboardShell>
  );
}
