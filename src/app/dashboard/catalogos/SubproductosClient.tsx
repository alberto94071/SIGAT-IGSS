"use client";
import { useState } from "react";
import { Layers, Plus, Pencil, Power, X, Check } from "lucide-react";
import { crearSubproducto, editarSubproducto, toggleSubproducto } from "./subproductos-actions";

type Sub = { id: number; nombre: string; activo: boolean };

export default function SubproductosClient({ subproductos: init }: { subproductos: Sub[] }) {
  const [lista,   setLista]   = useState(init);
  const [adding,  setAdding]  = useState(false);
  const [editId,  setEditId]  = useState<number | null>(null);
  const [texto,   setTexto]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleAdd() {
    if (!texto.trim()) return;
    setLoading(true);
    const res = await crearSubproducto(texto);
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(p => [...p, res.subproducto!]);
    setTexto(""); setAdding(false); setError("");
  }

  async function handleEdit(id: number) {
    if (!texto.trim()) return;
    setLoading(true);
    const res = await editarSubproducto(id, texto);
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(p => p.map(s => s.id === id ? { ...s, nombre: texto } : s));
    setEditId(null); setTexto(""); setError("");
  }

  async function handleToggle(s: Sub) {
    await toggleSubproducto(s.id, !s.activo);
    setLista(p => p.map(x => x.id === s.id ? { ...x, activo: !x.activo } : x));
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand-600" />
          Subproductos disponibles
          <span className="text-xs font-normal text-gray-400 ml-1">solo superadmin</span>
        </h2>
        {!adding && (
          <button onClick={() => { setAdding(true); setTexto(""); setError(""); }}
            className="btn-primary text-xs px-3 py-1.5">
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        )}
      </div>

      {adding && (
        <div className="flex gap-2">
          <input autoFocus className="input flex-1" placeholder="Nombre del subproducto…"
            value={texto} onChange={e => setTexto(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()} />
          <button onClick={handleAdd} disabled={loading}
            className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => { setAdding(false); setError(""); }}
            className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">{error}</p>}

      <div className="divide-y divide-gray-100">
        {lista.map(s => (
          <div key={s.id} className={`flex items-center gap-3 py-2.5 ${!s.activo ? "opacity-50" : ""}`}>
            {editId === s.id ? (
              <>
                <input autoFocus className="input flex-1 py-1 text-sm"
                  value={texto} onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleEdit(s.id)} />
                <button onClick={() => handleEdit(s.id)} disabled={loading}
                  className="p-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setEditId(null); setError(""); }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className={`flex-1 text-sm ${s.activo ? "text-gray-800" : "text-gray-400 line-through"}`}>
                  {s.nombre}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {s.activo ? "Activo" : "Inactivo"}
                </span>
                <button onClick={() => { setEditId(s.id); setTexto(s.nombre); setError(""); }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleToggle(s)}
                  title={s.activo ? "Deshabilitar" : "Habilitar"}
                  className={`p-1.5 rounded-lg transition-colors ${s.activo
                    ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
                    : "text-gray-400 hover:text-green-600 hover:bg-green-50"}`}>
                  <Power className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
        {lista.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">
            Aún no hay subproductos. Agrégalos para que los usuarios puedan seleccionarlos.
          </p>
        )}
      </div>
    </div>
  );
}
