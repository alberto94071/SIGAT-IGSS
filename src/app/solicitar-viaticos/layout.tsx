import { requireColaborador } from "@/lib/modulo-access";
import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import DashboardShell from "@/components/DashboardShell";

const NAV = [
  { href: "/solicitar-viaticos", label: "Mis Viáticos", icon: "MapPin" },
] as const;

export default async function SolicitarViaticosLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requireColaborador();

  return (
    <DashboardShell
      navItems={NAV}
      user={{ name: session.user.name ?? "", rol: "colaborador", email: "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS.colaborador}
      rolColor={ROL_COLORS.colaborador}
      moduleLabel="Solicitar Viáticos"
    >
      {children}
    </DashboardShell>
  );
}
