"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Package, CreditCard, Landmark, Wallet,
  FileCheck, BookOpen, BarChart3, FileText, Users, Settings, LogOut,
  ChevronLeft
} from "lucide-react";
import { type Rol, ROL_LABELS } from "@/lib/permisos";
import clsx from "clsx";

const ICONS: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="w-4 h-4" />,
  Package:         <Package         className="w-4 h-4" />,
  CreditCard:      <CreditCard      className="w-4 h-4" />,
  Landmark:        <Landmark        className="w-4 h-4" />,
  Wallet:          <Wallet          className="w-4 h-4" />,
  FileCheck:       <FileCheck       className="w-4 h-4" />,
  BookOpen:        <BookOpen        className="w-4 h-4" />,
  BarChart3:       <BarChart3       className="w-4 h-4" />,
  FileText:        <FileText        className="w-4 h-4" />,
  Users:           <Users           className="w-4 h-4" />,
  Settings:        <Settings        className="w-4 h-4" />,
};

interface Props {
  navItems: readonly { href: string; label: string; icon: string }[];
  user: { name: string; rol: Rol; email: string };
  moduleLabel?: string;
  onClose?: () => void;
}

export default function Sidebar({ navItems, user, moduleLabel = "Módulo", onClose }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-gray-900 text-white flex flex-col h-full">
      {/* Logo / Back to CIP */}
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight text-white">CIP</p>
            <p className="text-xs text-gray-400 truncate">Instituto Guatemalteco de Seguridad Social</p>
          </div>
        </div>
        <Link
          href="/launcher"
          onClick={onClose}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
          <span>Módulos CIP</span>
        </Link>
        <p className="mt-2 px-2 text-[11px] font-semibold text-brand-400 uppercase tracking-wider">
          {moduleLabel}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {navItems.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-brand-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              {ICONS[item.icon]}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-800 p-3">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="w-8 h-8 bg-brand-700 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-gray-400 truncate">{ROL_LABELS[user.rol]}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
