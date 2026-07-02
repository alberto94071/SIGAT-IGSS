"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Menu, XCircle, CheckCheck } from "lucide-react";
import { getMisNotificaciones, marcarNotificacionLeida, marcarTodasLeidas } from "@/app/notificaciones/actions";

interface Props {
  userName:    string;
  rolLabel:    string;
  rolColor:    string;
  onMenuOpen?: () => void;
}

type Notificacion = {
  id: number; tipo: string; titulo: string; mensaje: string;
  ruta: string | null; leida: boolean; created_at: string | null;
};

const POLL_MS = 30000;

export default function TopBar({ userName, rolLabel, rolColor, onMenuOpen }: Props) {
  const router = useRouter();
  const now = new Date();
  const fecha = now.toLocaleDateString("es-GT", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const [open,          setOpen]          = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas,      setNoLeidas]      = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  async function cargar() {
    const res = await getMisNotificaciones();
    setNotificaciones(res.notificaciones as Notificacion[]);
    setNoLeidas(res.noLeidas);
  }

  useEffect(() => {
    cargar();
    const interval = setInterval(cargar, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleClickNotif(n: Notificacion) {
    if (!n.leida) {
      await marcarNotificacionLeida(n.id);
      setNotificaciones(p => p.map(x => x.id === n.id ? { ...x, leida: true } : x));
      setNoLeidas(p => Math.max(0, p - 1));
    }
    setOpen(false);
    if (n.ruta) router.push(n.ruta);
  }

  async function handleMarcarTodas() {
    await marcarTodasLeidas();
    setNotificaciones(p => p.map(x => ({ ...x, leida: true })));
    setNoLeidas(0);
  }

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
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setOpen(p => !p)}
            className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Notificaciones"
          >
            <Bell className="w-4 h-4" />
            {noLeidas > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
                {noLeidas > 9 ? "9+" : noLeidas}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="font-semibold text-sm text-gray-900">Notificaciones</p>
                {noLeidas > 0 && (
                  <button onClick={handleMarcarTodas}
                    className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
                    <CheckCheck className="w-3.5 h-3.5" /> Marcar todas
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                {notificaciones.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">Sin notificaciones</p>
                )}
                {notificaciones.map(n => (
                  <button key={n.id} onClick={() => handleClickNotif(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex gap-2.5 ${!n.leida ? "bg-red-50/50" : ""}`}>
                    <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className={`text-sm ${!n.leida ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                        {n.titulo}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.mensaje}</p>
                      {n.created_at && <p className="text-[11px] text-gray-400 mt-1">{n.created_at}</p>}
                    </div>
                    {!n.leida && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5 ml-auto" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
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
