"use client";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function LogoutButton({ userName }: { userName: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <p className="text-sm font-medium text-white leading-tight">{userName}</p>
        <p className="text-xs text-green-300">Sesión activa</p>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-green-200 hover:text-white hover:bg-white/10 transition-colors border border-white/20"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline">Salir</span>
      </button>
    </div>
  );
}
