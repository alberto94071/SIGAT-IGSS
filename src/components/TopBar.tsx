"use client";
import { Bell } from "lucide-react";

interface Props {
  userName:  string;
  rolLabel:  string;
  rolColor:  string;
}

export default function TopBar({ userName, rolLabel, rolColor }: Props) {
  const now = new Date();
  const fecha = now.toLocaleDateString("es-GT", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <p className="text-sm text-gray-500 capitalize">{fecha}</p>
      <div className="flex items-center gap-3">
        <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${rolColor}`}>
            {rolLabel}
          </span>
          <span className="text-sm font-medium text-gray-700">{userName}</span>
        </div>
      </div>
    </header>
  );
}
