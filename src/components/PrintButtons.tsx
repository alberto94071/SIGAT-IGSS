"use client";
import { Printer, X } from "lucide-react";

export default function PrintButtons() {
  return (
    <div className="no-print flex items-center gap-3 mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <button
        onClick={() => window.print()}
        className="btn-primary"
      >
        <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
      </button>
      <button
        onClick={() => window.close()}
        className="btn-secondary"
      >
        <X className="w-4 h-4" /> Cerrar
      </button>
      <span className="text-xs text-gray-500 ml-2">
        Para imprimir la copia: el sistema generará automáticamente ambas versiones.
      </span>
    </div>
  );
}
