import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

const CAJA_CHICA_NAV = [
  { href: "/caja-chica/vale",             label: "Vale",             icon: "Receipt"   },
  { href: "/caja-chica/solicitud-pasaje", label: "Solicitud Pasaje", icon: "MapPin"    },
  { href: "/caja-chica/sps-23",           label: "SPS-23",           icon: "FileText"  },
  { href: "/caja-chica/poliza",           label: "Póliza",           icon: "FileCheck" },
  { href: "/caja-chica/liquidacion",      label: "Liquidación",      icon: "FileCheck" },
  { href: "/caja-chica/libro-caja-chica", label: "Libro Caja Chica", icon: "Coins"     },
] as const;

export default async function CajaChicaLayout({ children }: { children: React.ReactNode }) {
  const { session, rol } = await requireModuloAccess("mod_caja_chica");

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
