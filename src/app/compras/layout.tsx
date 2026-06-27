import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROL_LABELS, ROL_COLORS, type Rol } from "@/lib/permisos";
import DashboardShell from "@/components/DashboardShell";

const COMPRAS_NAV = [
  { href: "/compras/catalogo",     label: "Catálogo",     icon: "BookOpen"     },
  { href: "/compras/a01-siaf",     label: "A-01 SIAF",    icon: "FileText"     },
  { href: "/compras/adjudicacion", label: "Adjudicación", icon: "Gavel"        },
  { href: "/compras/ordenes",      label: "Órdenes",      icon: "ShoppingCart" },
] as const;

export default async function ComprasLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const rol = session.user.rol as Rol;

  return (
    <DashboardShell
      navItems={COMPRAS_NAV}
      user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS[rol]}
      rolColor={ROL_COLORS[rol]}
      moduleLabel="Compras"
    >
      {children}
    </DashboardShell>
  );
}
