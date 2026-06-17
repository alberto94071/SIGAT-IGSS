"use client";
import { useState, useMemo } from "react";
import { BookOpen, Plus, Pencil, Power, Search, X } from "lucide-react";
import { crearInsumo, editarInsumo, toggleInsumo } from "./actions";

type Insumo = {
  id: number; codigo_igss: number; codigo_ppr: string | null;
  codigo_minfin: number | null; nombre: string; caracteristicas: string | null;
  presentacion: string | null; unidad_medida: string | null;
  subproducto: string | null; cantidad_solicitada: number | null; activo: boolean;
};

interface Props { insumos: Insumo[]; canEdit: boolean; }

const EMPTY = {
  codigo_igss: 0, codigo_ppr: "", codigo_minfin: 0, nombre: "",
  caracteristicas: "", presentacion: "", unidad_medida: "", subproducto: "", cantidad_solicitada: "0",
};

export default function CatalogosClient({ insumos: init, canEdit }: Props) {
  const [lista,    setLista]    = useState(init);
  const [query,    setQuery]    = useState("");
  const [soloActivos, setSoloActivos] = useState(false);
  const [modal,    setModal]    = useState<"crear" | "editar" | null>(null);
  const [selected, setSelected] = useState<Insumo | null>(null);
  const [form,     setForm]     = useState(EMPTY);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const filtered = useMemo(() =>
    lista.filter(i => {
      const ok_query = !query || i.nombre.toLowerCase().includes(query.toLowerCase()) ||
        String(i.codigo_igss).includes(query);
      const ok_activo = !soloActivos || i.activo;
      return ok_query && ok_activo;
    }),
    [lista, query, soloActivos]
  );

  function openCrear() {
    setForm(EMPTY); setError("");
    setModal("crear");
  }
  function openEditar(i: Insumo) {
    setSelected(i);
    setForm({
      codigo_igss: i.codigo_igss, codigo_ppr: i.codigo_ppr ?? "",
      codigo_minfin: i.codigo_minfin ?? 0, nombre: i.nombre,
      caracteristicas: i.caracteristicas ?? "", presentacion: i.presentacion ?? "",
      unidad_medida: i.unidad_medida ?? "", subproducto: i.subproducto ?? "",
      cantidad_solicitada: i.cantidad_solicitada?.toString() ?? "0",
    });
    setError(""); setModal("editar");
  }

  async function handleCrear() {
    setLoading(true);
    const res = await crearInsumo(form);
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(prev => [...prev, res.insumo!]);
    setModal(null);
  }

  async function handleEditar() {
    if (!selected) return;
    setLoading(true);
    const res = await editarInsumo({ id: selected.id, ...form });
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(prev => prev.map(i => i.id === selected.id
      ? { ...i, ...form, cantidad_solicitada: form.cantidad_solicitada ? parseFloat(form.cantidad_solicitada) : null } : i));
    setModal(null);
  }

  async function handleToggle(i: Insumo) {
    await toggleInsumo({ id: i.id, activo: !i.activo });
    setLista(prev => prev.map(x => x.id === i.id ? { ...x, activo: !x.activo } : x));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Catálogo de insumos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} de {lista.length} insumos
          </p>
        </div>
        {canEdit && (
          <button onClick={openCrear} className="btn-primary">
            <Plus className="w-4 h-4" /> Nuevo insumo
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar por nombre o código IGSS…"
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)}
            className="rounded" />
          Solo activos
        </label>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Cód. IGSS</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Subproducto</th>
                <th className="px-4 py-3 text-left">Unidad</th>
                <th className="px-4 py-3 text-center">Estado</th>
                {canEdit && <th className="px-4 py-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(i => (
                <tr key={i.id} className={`hover:bg-gray-50 transition-colors ${!i.activo ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{i.codigo_igss}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 max-w-xs truncate">{i.nombre}</p>
                    {i.caracteristicas && (
                      <p className="text-xs text-gray-400 truncate max-w-xs">{i.caracteristicas}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{i.subproducto ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{i.unidad_medida ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${i.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${i.activo ? "bg-green-500" : "bg-gray-400"}`} />
                      {i.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEditar(i)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggle(i)}
                          title={i.activo ? "Deshabilitar temporalmente" : "Habilitar"}
                          className={`p-1.5 rounded-lg transition-colors ${i.activo
                            ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
                            : "text-gray-400 hover:text-green-600 hover:bg-green-50"}`}>
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">No se encontraron insumos</div>
          )}
        </div>
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-900">
                {modal === "crear" ? "Nuevo insumo" : "Editar insumo"}
              </h2>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Código IGSS</label>
                  <input className="input" type="number"
                    value={form.codigo_igss} onChange={e => setForm(p => ({ ...p, codigo_igss: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Código MINFIN</label>
                  <input className="input" type="number"
                    value={form.codigo_minfin} onChange={e => setForm(p => ({ ...p, codigo_minfin: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className="label">Nombre del insumo</label>
                <input className="input" value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div>
                <label className="label">Características</label>
                <textarea className="input" rows={2} value={form.caracteristicas}
                  onChange={e => setForm(p => ({ ...p, caracteristicas: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Código PpR</label>
                  <input className="input" value={form.codigo_ppr}
                    onChange={e => setForm(p => ({ ...p, codigo_ppr: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Subproducto</label>
                  <input className="input" value={form.subproducto}
                    onChange={e => setForm(p => ({ ...p, subproducto: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Presentación</label>
                  <input className="input" value={form.presentacion}
                    onChange={e => setForm(p => ({ ...p, presentacion: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Unidad de medida</label>
                  <input className="input" value={form.unidad_medida}
                    onChange={e => setForm(p => ({ ...p, unidad_medida: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Cantidad solicitada anual</label>
                <input className="input" type="number" value={form.cantidad_solicitada}
                  onChange={e => setForm(p => ({ ...p, cantidad_solicitada: e.target.value }))} />
              </div>
            </div>
            {error && (
              <div className="mx-5 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
              <button onClick={modal === "crear" ? handleCrear : handleEditar}
                disabled={loading} className="btn-primary">
                {loading ? "Guardando..." : (modal === "crear" ? "Crear insumo" : "Guardar cambios")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
