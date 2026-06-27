"use client";
import { useState, useMemo } from "react";
import { Users2, Plus, Pencil, Power, Search, X } from "lucide-react";
import { crearProveedor, editarProveedor, toggleProveedor } from "../actions";

type Proveedor = {
  id: number; nit: string | null; nombre: string; contacto: string | null;
  telefono: string | null; email: string | null; direccion: string | null; activo: boolean;
};

const EMPTY = { nit: "", nombre: "", contacto: "", telefono: "", email: "", direccion: "" };

export default function ProveedoresClient({ lista: init }: { lista: Proveedor[] }) {
  const [lista,    setLista]    = useState(init);
  const [query,    setQuery]    = useState("");
  const [modal,    setModal]    = useState<"crear" | "editar" | null>(null);
  const [selected, setSelected] = useState<Proveedor | null>(null);
  const [form,     setForm]     = useState(EMPTY);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return lista.filter(p =>
      !q ||
      p.nombre.toLowerCase().includes(q) ||
      (p.nit ?? "").includes(q) ||
      (p.contacto ?? "").toLowerCase().includes(q) ||
      (p.telefono ?? "").includes(q)
    );
  }, [lista, query]);

  function setF(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  function openCrear() { setForm(EMPTY); setError(""); setSelected(null); setModal("crear"); }
  function openEditar(p: Proveedor) {
    setSelected(p);
    setForm({ nit: p.nit ?? "", nombre: p.nombre, contacto: p.contacto ?? "", telefono: p.telefono ?? "", email: p.email ?? "", direccion: p.direccion ?? "" });
    setError(""); setModal("editar");
  }

  async function handleGuardar() {
    if (!form.nombre.trim()) return setError("El nombre es obligatorio");
    setLoading(true);
    const data = {
      nit:       form.nit.trim() || null,
      nombre:    form.nombre.trim(),
      contacto:  form.contacto.trim() || null,
      telefono:  form.telefono.trim() || null,
      email:     form.email.trim() || null,
      direccion: form.direccion.trim() || null,
    };
    if (modal === "crear") {
      const res = await crearProveedor(data);
      if (res.error) { setError(res.error); setLoading(false); return; }
      setLista(p => [...p, res.proveedor! as Proveedor].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } else if (selected) {
      const res = await editarProveedor(selected.id, data);
      if (res.error) { setError(res.error); setLoading(false); return; }
      setLista(p => p.map(x => x.id === selected.id ? { ...x, ...data } : x));
    }
    setLoading(false); setModal(null);
  }

  async function handleToggle(p: Proveedor) {
    await toggleProveedor(p.id, !p.activo);
    setLista(l => l.map(x => x.id === p.id ? { ...x, activo: !x.activo } : x));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users2 className="w-5 h-5 text-blue-600" /> Catálogo de Proveedores
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} de {lista.length} proveedores</p>
        </div>
        <button onClick={openCrear} className="btn-primary">
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por nombre, NIT, teléfono…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">NIT</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Contacto</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Teléfono</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Email</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${!p.activo ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{p.nit ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.nombre}</p>
                    {p.direccion && <p className="text-xs text-gray-400 truncate max-w-[200px]">{p.direccion}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.contacto ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.telefono ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.email ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${p.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.activo ? "bg-green-500" : "bg-gray-400"}`} />
                      {p.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEditar(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleToggle(p)} title={p.activo ? "Deshabilitar" : "Habilitar"}
                        className={`p-1.5 rounded-lg transition-colors ${p.activo ? "text-gray-400 hover:text-red-600 hover:bg-red-50" : "text-gray-400 hover:text-green-600 hover:bg-green-50"}`}>
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No se han registrado proveedores</div>
          )}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-900">{modal === "crear" ? "Nuevo proveedor" : "Editar proveedor"}</h2>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">NIT</label>
                  <input className="input" value={form.nit} onChange={e => setF("nit", e.target.value)} placeholder="Ej: 1234567-8" />
                </div>
                <div>
                  <label className="label">Nombre *</label>
                  <input className="input" value={form.nombre} onChange={e => setF("nombre", e.target.value)} placeholder="Razón social" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Contacto</label>
                  <input className="input" value={form.contacto} onChange={e => setF("contacto", e.target.value)} placeholder="Nombre del contacto" />
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input" value={form.telefono} onChange={e => setF("telefono", e.target.value)} placeholder="Ej: 7700-0000" />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email} onChange={e => setF("email", e.target.value)} placeholder="correo@empresa.com" />
              </div>
              <div>
                <label className="label">Dirección</label>
                <input className="input" value={form.direccion} onChange={e => setF("direccion", e.target.value)} placeholder="Dirección del proveedor" />
              </div>
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
