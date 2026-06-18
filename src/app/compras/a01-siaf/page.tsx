import { FileText, Construction } from "lucide-react";

export default function A01SiafPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="w-16 h-16 bg-yellow-50 ring-4 ring-yellow-200 rounded-2xl flex items-center justify-center">
        <FileText className="w-8 h-8 text-yellow-600" />
      </div>
      <div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Construction className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">En desarrollo</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">A-01 SIAF</h1>
        <p className="text-gray-500 mt-2 max-w-sm">
          El módulo de emisión y gestión de documentos A-01 SIAF estará disponible próximamente.
        </p>
      </div>
    </div>
  );
}
