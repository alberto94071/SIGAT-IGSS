"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Package, CreditCard, Landmark, Wallet,
  FileCheck, BookOpen, BarChart3, FileText, Users, Settings, LogOut,
  ChevronLeft, Gavel, ShoppingCart, MapPin, Receipt, Calculator,
  Archive, Library, FileSignature, Hash, LayoutGrid, TrendingUp,
  Layers, Route, Scale, Coins, Ticket,
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
  Gavel:           <Gavel           className="w-4 h-4" />,
  ShoppingCart:    <ShoppingCart    className="w-4 h-4" />,
  MapPin:          <MapPin          className="w-4 h-4" />,
  Receipt:         <Receipt         className="w-4 h-4" />,
  Calculator:      <Calculator      className="w-4 h-4" />,
  Archive:         <Archive         className="w-4 h-4" />,
  Library:         <Library         className="w-4 h-4" />,
  FileSignature:   <FileSignature   className="w-4 h-4" />,
  Hash:            <Hash            className="w-4 h-4" />,
  LayoutGrid:      <LayoutGrid      className="w-4 h-4" />,
  TrendingUp:      <TrendingUp      className="w-4 h-4" />,
  Layers:          <Layers          className="w-4 h-4" />,
  Route:           <Route           className="w-4 h-4" />,
  Scale:           <Scale           className="w-4 h-4" />,
  Coins:           <Coins           className="w-4 h-4" />,
  Ticket:          <Ticket          className="w-4 h-4" />,
};

interface Props {
  navItems: readonly { href: string; label: string; icon: string }[];
  user: { name: string; rol: Rol; email: string };
  moduleLabel?: string;
  onClose?: () => void;
}

export default function Sidebar({ navItems, user, moduleLabel = "Módulo", onClose }: Props) {
  const pathname = usePathname();

  // El nav activo es el href más específico (más largo) que calza con la ruta actual,
  // para que rutas anidadas (p. ej. "/administracion" y "/administracion/configuracion")
  // no se marquen ambas como activas a la vez.
  const activeHref = navItems
    .filter(item => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside className="w-60 text-white flex flex-col h-full" style={{ backgroundColor: "var(--cip-barra, #111827)" }}>
      {/* Logo / Back to CIP */}
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shrink-0 p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-cip.png" alt="Logo CIP" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight text-white">CIP</p>
            <p className="text-xs text-gray-400 truncate">Instituto Guatemalteco de Seguridad Social</p>
          </div>
        </div>
        <Link
          href="/launcher"
          onClick={onClose}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
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
          const isActive = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "text-white"
                  : "text-gray-400 hover:bg-white/10 hover:text-white"
              )}
              style={isActive ? { backgroundColor: "var(--cip-accent, #16a34a)" } : undefined}
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
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
