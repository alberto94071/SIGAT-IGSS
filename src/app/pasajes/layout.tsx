import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

const PASAJES_NAV = [
  { href: "/pasajes/solicitud-pasaje", label: "Solicitud Pasaje", icon: "MapPin"    },
  { href: "/pasajes/tarifario",        label: "Tarifario",        icon: "Layers"    },
  { href: "/pasajes/dpd-23",           label: "DPD-23",           icon: "FileText"  },
  { href: "/pasajes/poliza",           label: "Póliza",           icon: "FileCheck" },
] as const;

export default async function PasajesLayout({ children }: { children: React.ReactNode }) {
  const { session, rol } = await requireModuloAccess("mod_pasajes");

  return (
    <DashboardShell
      navItems={PASAJES_NAV}
      user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS[rol]}
      rolColor={ROL_COLORS[rol]}
      moduleLabel="Pago de Pasajes"
    >
      {children}
    </DashboardShell>
  );
}
