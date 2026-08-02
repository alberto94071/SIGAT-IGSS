"use client";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { type Rol } from "@/lib/permisos";

const COLLAPSE_KEY = "cip-sidebar-collapsed";

interface Props {
  navItems: readonly { href: string; label: string; icon: string }[];
  user: { name: string; rol: Rol; email: string };
  userName: string;
  rolLabel: string;
  rolColor: string;
  moduleLabel?: string;
  children: React.ReactNode;
}

export default function DashboardShell({
  navItems, user, userName, rolLabel, rolColor, moduleLabel, children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Se lee después del montaje (no en el render inicial) para no desincronizar
  // el HTML del servidor con el cliente — la preferencia es la misma en
  // cualquier módulo, por eso vive en localStorage y no en el state del layout.
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible print:block">
      {/* Overlay móvil */}
      {open && (
        <div
          className="print:hidden fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar — oculto al imprimir. En escritorio se puede plegar (ver
          toggleCollapsed) para que el área principal ocupe ese espacio. */}
      <div
        className={`print:hidden fixed inset-y-0 left-0 z-30 w-60 overflow-hidden transform transition-all duration-200 ease-in-out
          md:relative md:translate-x-0 md:z-auto md:shrink-0
          ${open ? "translate-x-0" : "-translate-x-full"}
          ${collapsed ? "md:w-0" : "md:w-60"}`}
      >
        <Sidebar navItems={navItems} user={user} moduleLabel={moduleLabel} onClose={() => setOpen(false)} />
      </div>

      {/* Área principal */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 print:overflow-visible print:block">
        <div className="print:hidden">
          <TopBar
            userName={userName}
            rolLabel={rolLabel}
            rolColor={rolColor}
            onMenuOpen={() => setOpen(true)}
            sidebarCollapsed={collapsed}
            onToggleSidebar={toggleCollapsed}
          />
        </div>
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 print:p-0 print:overflow-visible print:bg-white"
          style={{ backgroundColor: "var(--cip-fondo-main, #f9fafb)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
