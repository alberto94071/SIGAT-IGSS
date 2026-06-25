import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Bus, ArrowLeft, Construction } from "lucide-react";

export default async function PasajesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 max-w-md w-full overflow-hidden">
        <div className="h-2 bg-purple-500" />
        <div className="p-10 text-center">

          <div className="w-20 h-20 bg-purple-50 ring-4 ring-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Bus className="w-10 h-10 text-purple-500" />
          </div>

          <div className="flex items-center justify-center gap-2 mb-3">
            <Construction className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
              Módulo en construcción
            </span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pago de Pasajes</h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            Este módulo está en desarrollo. Pronto podrás controlar y registrar los
            pagos por concepto de pasajes y gastos de transportación del personal.
          </p>

          <Link
            href="/launcher"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a CIP
          </Link>
        </div>
      </div>
    </div>
  );
}
