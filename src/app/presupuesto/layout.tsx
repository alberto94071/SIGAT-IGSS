import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROL_LABELS, ROL_COLORS, type Rol } from "@/lib/permisos";
import DashboardShell from "@/components/DashboardShell";

const PRESUPUESTO_NAV = [
  { href: "/presupuesto/general",                label: "General",                            icon: "Calculator" },
  { href: "/presupuesto/compromiso-devengado",   label: "Compromiso y Devengado",             icon: "FileCheck"  },
  { href: "/presupuesto/programacion",           label: "Programación y Reprogramación",       icon: "BarChart3"  },
  { href: "/presupuesto/modificaciones",         label: "Modificaciones",                      icon: "FileSignature" },
] as const;

export default async function PresupuestoLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const rol = session.user.rol as Rol;

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
