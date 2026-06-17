import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { parsePermisos, NAV_ITEMS, ROL_LABELS, ROL_COLORS, type Rol } from "@/lib/permisos";
import Sidebar from "@/components/Sidebar";
import TopBar  from "@/components/TopBar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const rol      = session.user.rol as Rol;
  const permisos = parsePermisos(session.user.permisos, rol);

  // Filtrar nav según permisos
  const navItems = NAV_ITEMS.filter(item =>
    item.permiso === null || permisos[item.permiso as keyof typeof permisos]
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        navItems={navItems}
        user={{ name: session.user.name ?? "", rol, email: session.user.email ?? "" }}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          userName={session.user.name ?? ""}
          rolLabel={ROL_LABELS[rol]}
          rolColor={ROL_COLORS[rol]}
        />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
