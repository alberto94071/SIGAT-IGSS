import { BarChart3 } from "lucide-react";

export default function ReportesIndexPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-24 text-gray-400">
      <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm">
        Elegí un módulo en el menú de la izquierda para ver sus reportes disponibles.
      </p>
    </div>
  );
}
