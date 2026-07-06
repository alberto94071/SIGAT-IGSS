"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Archive, Search, Printer, X } from "lucide-react";

type Item = { id: number; nombre: string; subproducto: string; cantidad_solicitada: number };
type Solicitud = {
  id: number; numero: number; anio: number; fecha: string; estado: string;
  observaciones: string | null; items: Item[];
};
type Firmante = { id: number; nombre: string; cargo: string };

const ESTADO_STYLE: Record<string, string> = {
  "Borrador":        "bg-gray-100 text-gray-600",
  "Enviado":         "bg-blue-100 text-blue-700",
  "Aprobado":        "bg-green-100 text-green-700",
  "Rechazado":       "bg-red-100 text-red-700",
  "Consolidado":     "bg-purple-100 text-purple-700",
  "Adjudicado":      "bg-blue-100 text-blue-700",
  "Orden de Compra": "bg-indigo-100 text-indigo-700",
};

export default function ArchivoClient({ solicitudes, firmantes }: { solicitudes: Solicitud[]; firmantes: Firmante[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [printSol, setPrintSol] = useState<Solicitud | null>(null);
  const [selFirmante1, setSelFirmante1] = useState<Firmante | null>(null);
  const [selFirmante2, setSelFirmante2] = useState<Firmante | null>(null);

  const q = query.toLowerCase().trim();
  const filtered = useMemo(() => !q ? solicitudes : solicitudes.filter(s =>
    `${s.numero}/${s.anio}`.includes(q) ||
    s.fecha.includes(q) ||
    s.estado.toLowerCase().includes(q) ||
    s.items.some(i => i.nombre.toLowerCase().includes(q))
  ), [solicitudes, q]);

  function openPrint(s: Solicitud) {
    setPrintSol(s); setSelFirmante1(null); setSelFirmante2(null);
  }

  function goToPrint() {
    if (!printSol) return;
    const params = [selFirmante1?.id, selFirmante2?.id].filter(Boolean).join(",");
    router.push(`/compras/a01-siaf/${printSol.id}/imprimir?firmantes=${params}`);
    setPrintSol(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Archive className="w-5 h-5" /> Archivo — A-01 SIAF
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Todo SIAF generado queda aquí para siempre — desde aquí solo puedes verlo o volver a imprimirlo.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por correlativo, fecha, insumo…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Correlativo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left">Justificación</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{s.numero}/{s.anio}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.fecha}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate" title={s.observaciones ?? ""}>
                    {s.observaciones ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_STYLE[s.estado] ?? "bg-gray-100 text-gray-600"}`}>
                      {s.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openPrint(s)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors ml-auto">
                      <Printer className="w-3 h-3" /> Ver / Imprimir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{solicitudes.length === 0 ? "Aún no se ha generado ningún SIAF." : "Sin resultados para esa búsqueda."}</p>
            </div>
          )}
        </div>
      </div>

      {printSol && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">Imprimir A-01 SIAF {printSol.numero}/{printSol.anio}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Selecciona los firmantes del documento</p>
              </div>
              <button onClick={() => setPrintSol(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {[
                { label: "Firmante 1 (izquierda)", val: selFirmante1, set: setSelFirmante1 },
                { label: "Firmante 2 (derecha)",   val: selFirmante2, set: setSelFirmante2 },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="label">{label}</label>
                  <select className="input"
                    value={val?.id ?? ""}
                    onChange={e => {
                      const f = firmantes.find(f => f.id === Number(e.target.value)) ?? null;
                      set(f);
                    }}>
                    <option value="">— Sin firmante —</option>
                    {firmantes.map(f => (
                      <option key={f.id} value={f.id}>{f.nombre} — {f.cargo}</option>
                    ))}
                  </select>
                </div>
              ))}
              {firmantes.length === 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  No hay firmantes configurados. El superadmin debe agregarlos en Configuración → Firmantes.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setPrintSol(null)} className="btn-secondary">Cancelar</button>
              <button onClick={goToPrint} className="btn-primary">
                <Printer className="w-4 h-4" /> Abrir para imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
