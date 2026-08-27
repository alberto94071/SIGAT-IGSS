"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Trash2, Send, Printer, FileText, AlertTriangle, Loader2 } from "lucide-react";
import { actualizarItemBorrador, eliminarItemBorrador, enviarSolicitud } from "../actions";

type Item = { id: number; codigo: string; nombre: string; cantidad_solicitada: number };
type Borrador = { id: number; items: Item[] };
type Solicitud = {
  id: number; no_pedido: string | null; fecha_emision: string | null; estado: string;
  items: Item[];
};

const ESTADO_STYLE: Record<string, string> = {
  "Pendiente": "bg-blue-100 text-blue-700",
  "Aprobado":  "bg-green-100 text-green-700",
  "Rechazado": "bg-red-100 text-red-700",
};

export default function MiSolicitudClient({ borrador: borradorInicial, solicitudes }: {
  borrador: Borrador | null; solicitudes: Solicitud[];
}) {
  const router = useRouter();
  const [borrador, setBorrador] = useState(borradorInicial);
  const [salaServicio, setSalaServicio] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function cambiarCantidad(itemId: number, cantidad: number) {
    if (!borrador) return;
    setBorrador(prev => prev && { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, cantidad_solicitada: cantidad } : i) });
    const res = await actualizarItemBorrador(itemId, cantidad);
    if ("error" in res) setError(res.error);
  }

  async function quitarItem(itemId: number) {
    if (!borrador) return;
    setBorrador(prev => prev && { ...prev, items: prev.items.filter(i => i.id !== itemId) });
    await eliminarItemBorrador(itemId);
  }

  async function handleEnviar() {
    if (!borrador) return;
    if (!salaServicio.trim()) return setError("Indicá tu Sala o Servicio");
    setEnviando(true); setError("");
    const res = await enviarSolicitud(borrador.id, salaServicio);
    setEnviando(false);
    if ("error" in res) return setError(res.error);
    setBorrador(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5" /> Mis Solicitudes
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Tu carrito en progreso y el historial de todo lo que has solicitado.</p>
      </div>

      {borrador && borrador.items.length > 0 && (
        <div className="card p-5 space-y-4 border-2 border-brand-200">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-brand-600" /> Tu solicitud en progreso
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-3 py-2 text-left">Insumo</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Cantidad</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Quitar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {borrador.items.map(it => (
                  <tr key={it.id}>
                    <td className="px-3 py-2 text-gray-900">{it.nombre}</td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" min={0} step="0.01" className="input w-24 py-1 text-xs text-right"
                        value={it.cantidad_solicitada}
                        onChange={e => cambiarCantidad(it.id, parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => quitarItem(it.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-end gap-3 flex-wrap pt-2 border-t border-gray-100">
            <div className="flex-1 min-w-[200px]">
              <label className="label">Sala o Servicio</label>
              <input className="input" value={salaServicio} onChange={e => setSalaServicio(e.target.value)}
                placeholder="Ej. Secretaría" />
            </div>
            <button onClick={handleEnviar} disabled={enviando}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Solicitar
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>
      )}

      {(!borrador || borrador.items.length === 0) && (
        <div className="card p-6 text-center text-gray-400">
          <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Todavía no tenés insumos en tu solicitud — agregalos desde el Catálogo.</p>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Historial ({solicitudes.length})</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left whitespace-nowrap">No. Pedido</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                  <th className="px-4 py-3 text-left">Insumos</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {solicitudes.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{s.no_pedido ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{s.fecha_emision ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {s.items.slice(0, 2).map(i => i.nombre).join(", ")}
                      {s.items.length > 2 ? ` +${s.items.length - 2} más` : ""}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_STYLE[s.estado] ?? "bg-gray-100 text-gray-600"}`}>
                        {s.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {s.estado === "Aprobado" ? (
                        <Link href={`/solicitar-insumos/imprimir/${s.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                          <Printer className="w-3 h-3" /> Imprimir
                        </Link>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {solicitudes.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Todavía no has enviado ninguna solicitud.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
