import { Route } from "lucide-react";
import Link from "next/link";
import { requireModuloAccess } from "@/lib/modulo-access";

export default async function HojaDeRutaLayout({ children }: { children: React.ReactNode }) {
  await requireModuloAccess("mod_hoja_de_ruta");

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-gradient-to-r from-brand-700 to-brand-500 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center ring-2 ring-white/30">
              <Route className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none">Hoja de Ruta</h1>
              <p className="text-white/80 text-xs mt-0.5">Rastreo de pedidos y solicitudes de Compras</p>
            </div>
          </div>
          <Link
            href="/launcher"
            className="inline-flex items-center gap-1.5 text-sm text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            ← Menú principal
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {children}
      </main>
    </div>
  );
}
