"use client";
import { useState } from "react";
import { Map, Plus, X, Loader2, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { crearTarifa, actualizarTarifa, eliminarTarifa, type NuevaTarifaData } from "@/lib/pasajes-actions";

type Tarifa = { id: number; punto_partida: string; destino: string; valor_ida: number };

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TarifarioClient({ tarifario: init, canEdit }: { tarifario: Tarifa[]; canEdit: boolean }) {
  const [tarifario, setTarifario] = useState(init);
  const [modal, setModal] = useState<"nueva" | Tarifa | null>(null);

  async function handleEliminar(id: number) {
    if (!confirm("¿Eliminar esta tarifa?")) return;
    const res = await eliminarTarifa(id);
    if ("error" in res) return alert(res.error);
    setTarifario(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Map className="w-5 h-5" /> Tarifario de Pasajes
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{tarifario.length} ruta(s) registrada(s)</p>
        </div>
        {canEdit && (
          <button onClick={() => setModal("nueva")}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nueva Ruta
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Punto de partida</th>
                <th className="px-4 py-3 text-left">Destino</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Valor ida</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Valor total (ida y vuelta)</th>
                {canEdit && <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tarifario.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{t.punto_partida}</td>
                  <td className="px-4 py-3 text-gray-700">{t.destino}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 whitespace-nowrap">{Q(t.valor_ida)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">{Q(t.valor_ida * 2)}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setModal(t)} className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleEliminar(t.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {tarifario.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Map className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aún no se ha registrado ninguna ruta.</p>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <TarifaModal
          tarifa={modal === "nueva" ? null : modal}
          onClose={() => setModal(null)}
          onGuardado={t => {
            setTarifario(prev => modal === "nueva" ? [...prev, t] : prev.map(x => x.id === t.id ? t : x));
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function TarifaModal({ tarifa, onClose, onGuardado }: { tarifa: Tarifa | null; onClose: () => void; onGuardado: (t: Tarifa) => void }) {
  const [puntoPartida, setPuntoPartida] = useState(tarifa?.punto_partida ?? "");
  const [destino, setDestino] = useState(tarifa?.destino ?? "");
  const [valorIda, setValorIda] = useState(tarifa ? String(tarifa.valor_ida) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleGuardar() {
    const valor = parseFloat(valorIda);
    if (!puntoPartida.trim() || !destino.trim()) return setError("Punto de partida y destino son obligatorios");
    if (!(valor > 0)) return setError("Ingresa un valor de ida válido");

    const data: NuevaTarifaData = { punto_partida: puntoPartida.trim(), destino: destino.trim(), valor_ida: valor };
    setSaving(true); setError("");
    const res = tarifa ? await actualizarTarifa(tarifa.id, data) : await crearTarifa(data);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onGuardado({ id: tarifa?.id ?? Date.now(), ...data });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">{tarifa ? "Editar Ruta" : "Nueva Ruta"}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="label">Punto de partida</label>
            <input className="input" value={puntoPartida} onChange={e => setPuntoPartida(e.target.value)} />
          </div>
          <div>
            <label className="label">Destino</label>
            <input className="input" value={destino} onChange={e => setDestino(e.target.value)} />
          </div>
          <div>
            <label className="label">Valor de ida (Q.)</label>
            <input type="number" step="0.01" min="0.01" className="input" value={valorIda} onChange={e => setValorIda(e.target.value)} />
            <p className="mt-1 text-xs text-gray-400">El valor de vuelta es igual al de ida (total ida y vuelta: {valorIda ? Q(parseFloat(valorIda) * 2) : "—"}).</p>
          </div>
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
