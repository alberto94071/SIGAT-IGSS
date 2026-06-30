import { Construction } from "lucide-react";

export default function EnDesarrollo({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-md mx-auto mt-10">
      <div className="w-16 h-16 bg-amber-50 ring-4 ring-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <Construction className="w-8 h-8 text-amber-500" />
      </div>
      <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
        Módulo en desarrollo
      </span>
      <h1 className="text-xl font-bold text-gray-900 mt-2 mb-2">{title}</h1>
      {description && (
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
      )}
    </div>
  );
}
