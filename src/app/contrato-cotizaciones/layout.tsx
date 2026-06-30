import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROL_LABELS, ROL_COLORS, type Rol } from "@/lib/permisos";
import DashboardShell from "@/components/DashboardShell";

const CONTRATO_COTIZACIONES_NAV = [
  { href: "/contrato-cotizaciones/nog",              label: "NOG",               icon: "Hash"          },
  { href: "/contrato-cotizaciones/cotizaciones",      label: "Cotizaciones",      icon: "FileText"      },
  { href: "/contrato-cotizaciones/contrato-abierto",  label: "Contrato Abierto",  icon: "FileSignature" },
] as const;

export default async function ContratoCotizacionesLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const rol = session.user.rol as Rol;

  return (
    <DashboardShell
      navItems={CONTRATO_COTIZACIONES_NAV}
      user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS[rol]}
      rolColor={ROL_COLORS[rol]}
      moduleLabel="Contrato y Cotizaciones"
    >
      {children}
    </DashboardShell>
  );
}
