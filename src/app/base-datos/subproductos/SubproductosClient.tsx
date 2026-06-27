"use client";
import { useState, useMemo } from "react";
import { LayoutGrid, Plus, Pencil, Power, Search, X } from "lucide-react";
import { crearSubproducto, editarSubproducto, toggleSubproducto } from "../actions";

type Sub = { id: number; nombre: string; activo: boolean; created_at: string | null };

export default function SubproductosClient({ lista: init }: { lista: Sub[] }) {
  const [lista,   setLista]   = useState(init);
  const [query,   setQuery]   = useState("");
  const [modal,   setModal]   = useState<"crear" | "editar" | null>(null);
  const [selected,setSelected]= useState<Sub | null>(null);
  const [nombre,  setNombre]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const filtered = useMemo(() =>
    lista.filter(s => !query || s.nombre.toLowerCase().includes(query.toLowerCase())),
    [lista, query]
  );

  function openCrear() { setNombre(""); setError(""); setSelected(null); setModal("crear"); }
  function openEditar(s: Sub) { setSelected(s); setNombre(s.nombre); setError(""); setModal("editar"); }

  async function handleGuardar() {
    if (!nombre.trim()) return setError("El nombre es obligatorio");
    setLoading(true);
    if (modal === "crear") {
      const res = await crearSubproducto(nombre.trim());
      if (res.error) { setError(res.error); setLoading(false); return; }
      setLista(p => [...p, res.subproducto! as Sub].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } else if (selected) {
      const res = await editarSubproducto(selected.id, nombre.trim());
      if (res.error) { setError(res.error); setLoading(false); return; }
      setLista(p => p.map(s => s.id === selected.id ? { ...s, nombre: nombre.trim() } : s));
    }
    setLoading(false); setModal(null);
  }

  async function handleToggle(s: Sub) {
    await toggleSubproducto(s.id, !s.activo);
    setLista(p => p.map(x => x.id === s.id ? { ...x, activo: !x.activo } : x));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-blue-600" /> Catálogo de Subproductos
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} de {lista.length} subproductos</p>
        </div>
        <button onClick={openCrear} className="btn-primary">
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar subproducto…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3 text-left">Nombre del subproducto</th>
              <th className="px-4 py-3 text-center whitespace-nowrap">Estado</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(s => (
              <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${!s.activo ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{s.nombre}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.activo ? "bg-green-500" : "bg-gray-400"}`} />
                    {s.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openEditar(s)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleToggle(s)} title={s.activo ? "Deshabilitar" : "Habilitar"}
                      className={`p-1.5 rounded-lg transition-colors ${s.activo ? "text-gray-400 hover:text-red-600 hover:bg-red-50" : "text-gray-400 hover:text-green-600 hover:bg-green-50"}`}>
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No se encontraron subproductos</div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{modal === "crear" ? "Nuevo subproducto" : "Editar subproducto"}</h2>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4">
              <label className="label">Nombre del subproducto *</label>
              <input className="input font-mono" value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="Ej: 001-004-0001" autoFocus />
            </div>
            {error && <div className="mx-5 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleGuardar} disabled={loading} className="btn-primary">
                {loading ? "Guardando…" : modal === "crear" ? "Agregar" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
