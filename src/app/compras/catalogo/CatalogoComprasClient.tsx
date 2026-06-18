"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { BookOpen, Plus, Pencil, Power, Search, X, ChevronDown, Loader2 } from "lucide-react";
import { crearInsumoCompras, editarInsumoCompras, toggleInsumoCompras, buscarCatalogoGeneral } from "./actions";

type Insumo = {
  id: number; codigo_igss: number | null; codigo_ppr: string | null;
  nombre: string; caracteristicas: string | null; presentacion: string | null;
  unidad_medida: string | null; subproducto: string; cantidad: number | null;
  activo: boolean;
};

type Sugerencia = {
  codigo_igss: number | null; codigo_ppr: string | null; nombre: string | null;
  caracteristicas: string | null; presentacion: string | null; unidad_medida: string | null;
};

const EMPTY = {
  codigo_igss: "", codigo_ppr: "", nombre: "", caracteristicas: "",
  presentacion: "", unidad_medida: "", subproducto: "", cantidad: "",
};

interface Props { insumos: Insumo[]; canEdit: boolean; }

export default function CatalogoComprasClient({ insumos: init, canEdit }: Props) {
  const [lista,       setLista]       = useState(init);
  const [query,       setQuery]       = useState("");
  const [soloActivos, setSoloActivos] = useState(false);
  const [modal,       setModal]       = useState<"crear" | "editar" | null>(null);
  const [selected,    setSelected]    = useState<Insumo | null>(null);
  const [form,        setForm]        = useState(EMPTY);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  // Autocomplete catálogo general
  const [busqText,    setBusqText]    = useState("");
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [buscando,    setBuscando]    = useState(false);
  const [showDrop,    setShowDrop]    = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() =>
    lista.filter(i => {
      const ok = !query ||
        i.nombre.toLowerCase().includes(query.toLowerCase()) ||
        (i.codigo_ppr ?? "").includes(query) ||
        String(i.codigo_igss ?? "").includes(query) ||
        i.subproducto.includes(query);
      return ok && (!soloActivos || i.activo);
    }),
    [lista, query, soloActivos]
  );

  // Debounce buscarCatalogoGeneral
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!busqText || busqText.trim().length < 2) { setSugerencias([]); return; }
    setBuscando(true);
    debounceRef.current = setTimeout(async () => {
      const res = await buscarCatalogoGeneral(busqText);
      setSugerencias(res as Sugerencia[]);
      setBuscando(false);
      setShowDrop(true);
    }, 350);
  }, [busqText]);

  function setF(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  function pickSugerencia(s: Sugerencia) {
    setForm(p => ({
      ...p,
      codigo_igss:     String(s.codigo_igss ?? ""),
      codigo_ppr:      s.codigo_ppr ?? "",
      nombre:          s.nombre ?? "",
      caracteristicas: s.caracteristicas ?? "",
      presentacion:    s.presentacion ?? "",
      unidad_medida:   s.unidad_medida ?? "",
    }));
    setBusqText(s.nombre ?? "");
    setShowDrop(false);
  }

  function openCrear() {
    setForm(EMPTY); setBusqText(""); setSugerencias([]);
    setError(""); setModal("crear");
  }

  function openEditar(i: Insumo) {
    setSelected(i);
    setForm({
      codigo_igss:     String(i.codigo_igss ?? ""),
      codigo_ppr:      i.codigo_ppr ?? "",
      nombre:          i.nombre,
      caracteristicas: i.caracteristicas ?? "",
      presentacion:    i.presentacion ?? "",
      unidad_medida:   i.unidad_medida ?? "",
      subproducto:     i.subproducto,
      cantidad:        i.cantidad?.toString() ?? "",
    });
    setBusqText(i.nombre);
    setSugerencias([]);
    setError(""); setModal("editar");
  }

  async function handleCrear() {
    if (!form.nombre || !form.subproducto) return setError("Nombre y subproducto son obligatorios");
    setLoading(true);
    const res = await crearInsumoCompras(form);
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(p => [res.insumo!, ...p] as unknown as Insumo[]);
    setModal(null);
  }

  async function handleEditar() {
    if (!selected || !form.nombre || !form.subproducto) return setError("Nombre y subproducto son obligatorios");
    setLoading(true);
    const res = await editarInsumoCompras({ id: selected.id, ...form });
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(p => p.map(i => i.id === selected.id
      ? { ...i, ...form, codigo_igss: form.codigo_igss ? Number(form.codigo_igss) : null, cantidad: form.cantidad ? parseFloat(form.cantidad) : null }
      : i) as unknown as Insumo[]);
    setModal(null);
  }

  async function handleToggle(i: Insumo) {
    await toggleInsumoCompras(i.id, !i.activo);
    setLista(p => p.map(x => x.id === i.id ? { ...x, activo: !x.activo } : x));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Catálogo de insumos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} de {lista.length} insumos de la unidad
          </p>
        </div>
        {canEdit && (
          <button onClick={openCrear} className="btn-primary">
            <Plus className="w-4 h-4" /> Agregar insumo
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar por nombre, código PPR, subproducto…"
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} className="rounded" />
          Solo activos
        </label>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Cód. IGSS</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Código PPR</th>
                <th className="px-4 py-3 text-left">Nombre / Características</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Presentación</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Unidad</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Subproducto</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Cantidad</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Estado</th>
                {canEdit && <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(i => (
                <tr key={i.id} className={`hover:bg-gray-50 transition-colors ${!i.activo ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{i.codigo_igss ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{i.codigo_ppr ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{i.nombre}</p>
                    {i.caracteristicas && <p className="text-xs text-gray-400 truncate max-w-[260px]">{i.caracteristicas}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{i.presentacion ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{i.unidad_medida ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{i.subproducto}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm font-medium text-gray-800 whitespace-nowrap">
                    {i.cantidad != null ? i.cantidad.toLocaleString("es-GT") : "—"}
                  </td>
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
                          title={i.activo ? "Deshabilitar" : "Habilitar"}
                          className={`p-1.5 rounded-lg transition-colors ${i.activo ? "text-gray-400 hover:text-red-600 hover:bg-red-50" : "text-gray-400 hover:text-green-600 hover:bg-green-50"}`}>
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

      {/* ── Modal ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-900">
                {modal === "crear" ? "Agregar insumo al catálogo" : "Editar insumo"}
              </h2>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Buscador en catálogo general */}
              <div className="relative">
                <label className="label">Buscar en catálogo general IGSS</label>
                <p className="text-xs text-gray-400 mb-1.5">
                  Escribe el código PPR o el nombre — se auto-rellenarán los campos.
                </p>
                <div className="relative">
                  <input className="input pr-10" value={busqText}
                    onChange={e => { setBusqText(e.target.value); setShowDrop(true); }}
                    onFocus={() => busqText.length >= 2 && setShowDrop(true)}
                    onBlur={() => setTimeout(() => setShowDrop(false), 180)}
                    placeholder="Ej: Irbesartan o 7213-21343…" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {buscando
                      ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                      : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>
                {showDrop && sugerencias.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {sugerencias.map((s, i) => (
                      <button key={i} type="button"
                        onMouseDown={() => pickSugerencia(s)}
                        className="w-full text-left px-4 py-2.5 hover:bg-green-50 transition-colors border-b border-gray-50 last:border-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.nombre}</p>
                        <p className="text-xs text-gray-400">
                          {s.codigo_ppr && `PPR: ${s.codigo_ppr}`}
                          {s.codigo_igss && ` · IGSS: ${s.codigo_igss}`}
                          {s.presentacion && ` · ${s.presentacion}`}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {showDrop && !buscando && busqText.length >= 2 && sugerencias.length === 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 text-sm text-gray-400">
                    No se encontró en el catálogo general. Puedes ingresar los datos manualmente.
                  </div>
                )}
              </div>

              {/* Campos auto-rellenados (o manuales) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Código IGSS</label>
                  <input className="input" type="number" value={form.codigo_igss}
                    onChange={e => setF("codigo_igss", e.target.value)} />
                </div>
                <div>
                  <label className="label">Código PPR</label>
                  <input className="input" value={form.codigo_ppr}
                    onChange={e => setF("codigo_ppr", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">Nombre del insumo *</label>
                <input className="input" value={form.nombre}
                  onChange={e => setF("nombre", e.target.value)} />
              </div>

              <div>
                <label className="label">Características</label>
                <textarea className="input" rows={2} value={form.caracteristicas}
                  onChange={e => setF("caracteristicas", e.target.value)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Presentación</label>
                  <input className="input" value={form.presentacion}
                    onChange={e => setF("presentacion", e.target.value)} />
                </div>
                <div>
                  <label className="label">Unidad de medida</label>
                  <input className="input" value={form.unidad_medida}
                    onChange={e => setF("unidad_medida", e.target.value)} />
                </div>
              </div>

              {/* Campos manuales obligatorios */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Datos de la unidad
                </p>
                <div>
                  <label className="label">Subproducto *</label>
                  <input className="input font-mono" value={form.subproducto}
                    onChange={e => setF("subproducto", e.target.value)}
                    placeholder="Ej: 003-005-0004" />
                </div>
                <div>
                  <label className="label">Cantidad autorizada</label>
                  <input className="input" type="number" value={form.cantidad}
                    onChange={e => setF("cantidad", e.target.value)}
                    placeholder="0" />
                </div>
              </div>
            </div>

            {error && (
              <div className="mx-5 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
              <button onClick={modal === "crear" ? handleCrear : handleEditar}
                disabled={loading} className="btn-primary">
                {loading ? "Guardando…" : (modal === "crear" ? "Agregar al catálogo" : "Guardar cambios")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
