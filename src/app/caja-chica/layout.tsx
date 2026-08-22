import { ROL_LABELS, ROL_COLORS } from "@/lib/permisos";
import { requireModuloAccess } from "@/lib/modulo-access";
import DashboardShell from "@/components/DashboardShell";

const CAJA_CHICA_NAV = [
  { href: "/caja-chica/vale",             label: "Vale",             icon: "Receipt",   permiso: "tab_cajachica_vale"        },
  { href: "/caja-chica/pagos",            label: "Pagos",            icon: "Wallet",    permiso: "tab_cajachica_pagos"       },
  { href: "/caja-chica/liquidacion",      label: "Liquidación",      icon: "FileCheck", permiso: "tab_cajachica_liquidacion" },
  { href: "/caja-chica/libro-caja-chica", label: "Libro Caja Chica", icon: "Coins",     permiso: "tab_cajachica_libro"       },
] as const;

export default async function CajaChicaLayout({ children }: { children: React.ReactNode }) {
  const { session, rol, permisos } = await requireModuloAccess("mod_caja_chica");
  const navItems = CAJA_CHICA_NAV.filter(item => permisos[item.permiso]);

  return (
    <DashboardShell
      navItems={navItems}
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
