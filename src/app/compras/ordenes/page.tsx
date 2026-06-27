import { ShoppingCart } from "lucide-react";

export default function OrdenesPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
        <ShoppingCart className="w-7 h-7 text-gray-400" />
      </div>
      <h2 className="text-lg font-semibold text-gray-700">Módulo de Órdenes</h2>
      <p className="text-sm text-gray-400 max-w-sm">
        Este módulo está en construcción. Aquí se gestionarán las órdenes de compra generadas a partir de las adjudicaciones.
      </p>
    </div>
  );
}
