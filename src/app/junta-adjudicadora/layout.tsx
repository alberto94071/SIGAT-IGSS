import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROL_LABELS, ROL_COLORS, type Rol } from "@/lib/permisos";
import DashboardShell from "@/components/DashboardShell";

const JUNTA_ADJUDICADORA_NAV = [
  { href: "/junta-adjudicadora/adjudicacion", label: "Adjudicación", icon: "Gavel"    },
  { href: "/junta-adjudicadora/acta",         label: "Acta",         icon: "FileText" },
] as const;

export default async function JuntaAdjudicadoraLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const rol = session.user.rol as Rol;

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
