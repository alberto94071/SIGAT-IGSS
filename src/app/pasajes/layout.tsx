import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

const PASAJES_NAV = [
  { href: "/pasajes/solicitud-pasaje", label: "Solicitud Pasaje", icon: "MapPin",    permiso: "tab_pasajes_solicitud" },
  { href: "/pasajes/tarifario",        label: "Tarifario",        icon: "Layers",    permiso: "tab_pasajes_tarifario" },
  { href: "/pasajes/dpd-23",           label: "DPD-23",           icon: "FileText",  permiso: "tab_pasajes_dpd23"     },
  { href: "/pasajes/poliza",           label: "Póliza",           icon: "FileCheck", permiso: "tab_pasajes_poliza"    },
] as const;

export default async function PasajesLayout({ children }: { children: React.ReactNode }) {
  const { session, rol, permisos } = await requireModuloAccess("mod_pasajes");
  const navItems = PASAJES_NAV.filter(item => permisos[item.permiso]);

  return (
    <DashboardShell
      navItems={navItems}
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
