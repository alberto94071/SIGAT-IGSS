import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROL_LABELS, ROL_COLORS, type Rol } from "@/lib/permisos";
import DashboardShell from "@/components/DashboardShell";

const LIBROS_NAV = [
  { href: "/libros/banco",        label: "Libro de Banco",      icon: "Landmark"  },
  { href: "/libros/conciliacion", label: "Libro Conciliación",  icon: "FileCheck" },
  { href: "/libros/caja-chica",   label: "Libro Caja Chica",    icon: "Wallet"    },
] as const;

export default async function LibrosLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const rol = session.user.rol as Rol;

  return (
    <DashboardShell
      navItems={LIBROS_NAV}
      user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      userName={session.user.name ?? ""}
      rolLabel={ROL_LABELS[rol]}
      rolColor={ROL_COLORS[rol]}
      moduleLabel="Libros"
    >
      {children}
    </DashboardShell>
  );
}
