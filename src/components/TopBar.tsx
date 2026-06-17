"use client";
import { Bell, Menu } from "lucide-react";

interface Props {
  userName:    string;
  rolLabel:    string;
  rolColor:    string;
  onMenuOpen?: () => void;
}

export default function TopBar({ userName, rolLabel, rolColor, onMenuOpen }: Props) {
  const now = new Date();
  const fecha = now.toLocaleDateString("es-GT", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-3 sm:px-6 shrink-0">
      <div className="flex items-center gap-2">
        {/* Hamburger — solo visible en móvil */}
        <button
          onClick={onMenuOpen}
          className="md:hidden p-2 -ml-1 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
        <p className="text-sm text-gray-500 capitalize hidden sm:block">{fecha}</p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${rolColor}`}>
            {rolLabel}
          </span>
          <span className="text-sm font-medium text-gray-700 max-w-[120px] sm:max-w-none truncate">
            {userName}
          </span>
        </div>
      </div>
    </header>
  );
}
