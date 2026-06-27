import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Database } from "lucide-react";
import Link from "next/link";
import NavBaseDatos from "./NavBaseDatos";

export default async function BaseDatosLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-gradient-to-r from-blue-700 to-blue-500 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center ring-2 ring-white/30">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none">Base de Datos Central</h1>
              <p className="text-blue-200 text-xs mt-0.5">IGSS · Unidad 407 · Tejutla, San Marcos</p>
            </div>
          </div>
          <Link
            href="/launcher"
            className="inline-flex items-center gap-1.5 text-sm text-blue-100 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            ← Menú principal
          </Link>
        </div>
        <NavBaseDatos />
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 py-3">
        <p className="text-center text-xs text-gray-400">
          CIP · Base de Datos Central · Instituto Guatemalteco de Seguridad Social
        </p>
      </footer>
    </div>
  );
}
