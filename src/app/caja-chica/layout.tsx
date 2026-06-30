import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROL_LABELS, ROL_COLORS, type Rol } from "@/lib/permisos";
import DashboardShell from "@/components/DashboardShell";

const CAJA_CHICA_NAV = [
  { href: "/caja-chica/vale",             label: "Vale",             icon: "Receipt"   },
  { href: "/caja-chica/solicitud-pasaje", label: "Solicitud Pasaje", icon: "MapPin"    },
  { href: "/caja-chica/sps-23",           label: "SPS-23",           icon: "FileText"  },
  { href: "/caja-chica/poliza",           label: "Póliza",           icon: "FileCheck" },
  { href: "/caja-chica/liquidacion",      label: "Liquidación",      icon: "FileCheck" },
] as const;

export default async function CajaChicaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const rol = session.user.rol as Rol;

  return (
    <DashboardShell
      navItems={CAJA_CHICA_NAV}
      user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS[rol]}
      rolColor={ROL_COLORS[rol]}
      moduleLabel="Caja Chica"
    >
      {children}
    </DashboardShell>
  );
}
