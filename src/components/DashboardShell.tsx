"use client";
import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { type Rol } from "@/lib/permisos";

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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Overlay móvil */}
      {open && (
        <div
          className="print:hidden fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar — oculto al imprimir */}
      <div
        className={`print:hidden fixed inset-y-0 left-0 z-30 w-60 transform transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0 md:z-auto md:shrink-0
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Sidebar navItems={navItems} user={user} moduleLabel={moduleLabel} onClose={() => setOpen(false)} />
      </div>

      {/* Área principal */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="print:hidden">
          <TopBar
            userName={userName}
            rolLabel={rolLabel}
            rolColor={rolColor}
            onMenuOpen={() => setOpen(true)}
          />
        </div>
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 bg-gray-50 print:p-0 print:overflow-visible print:bg-white">
          {children}
        </main>
      </div>
    </div>
  );
}
