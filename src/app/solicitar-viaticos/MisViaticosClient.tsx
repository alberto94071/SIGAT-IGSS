"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Send, AlertTriangle, Loader2, Clock } from "lucide-react";
import { solicitarViatico } from "./actions";

type Solicitud = {
  id: number; estado: string; numero_formulario: string | null;
  nombramiento_numero: string | null; fecha_nombramiento: string | null;
  fecha_limite: string | null; created_at: string | null;
};

const ESTADO_STYLE: Record<string, string> = {
  "Pendiente":  "bg-amber-100 text-amber-700",
  "Habilitado": "bg-blue-100 text-blue-700",
  "Enviado":    "bg-blue-100 text-blue-700",
  "Aprobado":   "bg-green-100 text-green-700",
  "Rechazado":  "bg-red-100 text-red-700",
};

const ESTA_ACTIVA = (estado: string) => ["Pendiente", "Habilitado", "Enviado"].includes(estado);

export default function MisViaticosClient({ solicitudes }: { solicitudes: Solicitud[] }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const tieneActiva = solicitudes.some(s => ESTA_ACTIVA(s.estado));

  async function handleSolicitar() {
    setEnviando(true); setError("");
    const res = await solicitarViatico();
    setEnviando(false);
    if ("error" in res) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin className="w-5 h-5" /> Mis Viáticos
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Solicitá un viático por comisión de trabajo y seguí su trámite acá.</p>
      </div>

      {!tieneActiva && (
        <div className="card p-5 space-y-3">
          <p className="text-sm text-gray-600">Cuando te nombren de comisión, pedí tu viático acá — el encargado de Viáticos lo habilita y vas a poder registrar los datos de tu comisión.</p>
          <button onClick={handleSolicitar} disabled={enviando}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Solicitar Viático
          </button>
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>
      )}

      {tieneActiva && (
        <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <Clock className="w-4 h-4 shrink-0 mt-0.5" />
          Ya tenés un viático en trámite — mirá el estado abajo. Cuando el encargado lo habilite vas a poder registrar tu comisión.
        </div>
      )}

      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Historial ({solicitudes.length})</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left whitespace-nowrap">No. Formulario</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Nombramiento</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Fecha límite</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {solicitudes.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{s.numero_formulario ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {s.nombramiento_numero ? `${s.nombramiento_numero}${s.fecha_nombramiento ? ` (${s.fecha_nombramiento})` : ""}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.fecha_limite ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_STYLE[s.estado] ?? "bg-gray-100 text-gray-600"}`}>
                        {s.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {solicitudes.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Todavía no has pedido ningún viático.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
