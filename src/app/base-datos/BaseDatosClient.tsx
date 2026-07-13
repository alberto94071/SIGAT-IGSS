"use client";
import { useState, useMemo, useEffect, useTransition } from "react";
import { Plus, Search, Pencil, Trash2, X, Package } from "lucide-react";
import { crearInsumo, editarInsumo, eliminarInsumo } from "./actions";
import { useRouter, usePathname } from "next/navigation";

type Insumo = {
  id: number;
  codigo_igss: string | null;
  codigo_ppr: number | null;
  nombre: string;
  caracteristicas: string | null;
  presentacion: string | null;
  renglon: number | null;
  activo: boolean;
};

const EMPTY = { codigo_igss: "", codigo_ppr: "", nombre: "", caracteristicas: "", presentacion: "", renglon: "" };

interface BaseDatosClientProps {
  registros: Insumo[];
  totalCount: number;
  currentPage: number;
  limit: number;
  allRenglones: number[];
  initQ: string;
  initRenglon: string;
}

export default function BaseDatosClient({
  registros,
  totalCount,
  currentPage,
  limit,
  allRenglones,
  initQ,
  initRenglon,
}: BaseDatosClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [lista,         setLista]         = useState(registros);
  const [query,         setQuery]         = useState(initQ);
  const [filtroRenglon, setFiltroRenglon] = useState(initRenglon);
  const [modal,         setModal]         = useState<"crear" | "editar" | null>(null);
  const [selected,      setSelected]      = useState<Insumo | null>(null);
  const [form,          setForm]          = useState(EMPTY);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");

  // Sincronizar estado local con props del servidor
  useEffect(() => {
    setLista(registros);
  }, [registros]);

  useEffect(() => {
    setQuery(initQ);
  }, [initQ]);

  useEffect(() => {
    setFiltroRenglon(initRenglon);
  }, [initRenglon]);

  // Búsqueda debounced por URL
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query === initQ) return;
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (filtroRenglon) params.set("renglon", filtroRenglon);
      params.set("page", "1");
      
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query, pathname, router, initQ, filtroRenglon]);

  function handleRenglonChange(val: string) {
    setFiltroRenglon(val);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (val) params.set("renglon", val);
    params.set("page", "1");
    
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function navigateToPage(p: number) {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (filtroRenglon) params.set("renglon", filtroRenglon);
    params.set("page", String(p));
    
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const renglones = allRenglones;
  const filtered = lista;

  function setF(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  function openCrear() {
    setForm(EMPTY); setError(""); setSelected(null); setModal("crear");
  }

  function openEditar(r: Insumo) {
    setSelected(r);
    setForm({
      codigo_igss:     String(r.codigo_igss ?? ""),
      codigo_ppr:      String(r.codigo_ppr ?? ""),
      nombre:          r.nombre,
      caracteristicas: r.caracteristicas ?? "",
      presentacion:    r.presentacion ?? "",
      renglon:         String(r.renglon ?? ""),
    });
    setError(""); setModal("editar");
  }

  async function handleGuardar() {
    if (!form.nombre.trim()) return setError("El nombre es obligatorio");
    setLoading(true);
    const data = {
      codigo_igss:     form.codigo_igss.trim() || null,
      codigo_ppr:      form.codigo_ppr ? Number(form.codigo_ppr) : null,
      nombre:          form.nombre.trim(),
      caracteristicas: form.caracteristicas.trim() || null,
      presentacion:    form.presentacion.trim() || null,
      renglon:         form.renglon ? Number(form.renglon) : null,
    };
    if (modal === "crear") {
      const res = await crearInsumo(data);
      if (res.error) { setError(res.error); setLoading(false); return; }
      setLista(p => [...p, res.registro! as Insumo]);
    } else if (selected) {
      const res = await editarInsumo(selected.id, data);
      if (res.error) { setError(res.error); setLoading(false); return; }
      setLista(p => p.map(r => r.id === selected.id ? { ...r, ...data } : r));
    }
    setLoading(false); setModal(null);
  }

  async function handleEliminar(r: Insumo) {
    if (!confirm(`¿Eliminar "${r.nombre}" de la base de datos central?`)) return;
    await eliminarInsumo(r.id);
    setLista(p => p.filter(x => x.id !== r.id));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" /> Central de Insumos
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {isPending ? (
              <span className="animate-pulse text-blue-600 font-medium">Buscando...</span>
            ) : (
              `${totalCount.toLocaleString("es-GT")} registros`
            )}
          </p>
        </div>
        <button onClick={openCrear} className="btn-primary">
          <Plus className="w-4 h-4" /> Agregar insumo
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por nombre, características, código PPR/IGSS…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <select
          className="input w-44"
          value={filtroRenglon}
          onChange={e => handleRenglonChange(e.target.value)}
        >
          <option value="">Todos los renglones</option>
          {renglones.map(r => (
            <option key={r} value={String(r)}>Renglón {r}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Cód. IGSS</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Cód. PPR</th>
                <th className="px-4 py-3 text-left">Nombre / Características</th>
                <th className="px-4 py-3 text-left">Presentación</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Renglón</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                    {r.codigo_igss ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                    {r.codigo_ppr ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-gray-900 leading-tight">{r.nombre}</p>
                    {r.caracteristicas && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{r.caracteristicas}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">
                    {r.presentacion ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.renglon ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {r.renglon}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEditar(r)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleEliminar(r)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No se encontraron insumos</div>
          )}
        </div>
        {/* Pagination Footer */}
        {Math.ceil(totalCount / limit) > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 py-3 px-5 text-sm select-none">
            <p className="text-xs text-gray-500 font-medium">
              Mostrando <span className="font-semibold text-gray-700">{(currentPage - 1) * limit + 1}</span> -{" "}
              <span className="font-semibold text-gray-700">
                {Math.min((currentPage - 1) * limit + limit, totalCount)}
              </span>{" "}
              de <span className="font-semibold text-gray-700">{totalCount.toLocaleString("es-GT")}</span> registros
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateToPage(currentPage - 1)}
                disabled={currentPage <= 1 || isPending}
                className="btn-secondary py-1 px-3 text-xs disabled:opacity-50 transition-all font-medium"
              >
                Anterior
              </button>
              <span className="text-xs text-gray-600 font-medium px-2">
                Página {currentPage} de {Math.ceil(totalCount / limit)}
              </span>
              <button
                onClick={() => navigateToPage(currentPage + 1)}
                disabled={currentPage >= Math.ceil(totalCount / limit) || isPending}
                className="btn-secondary py-1 px-3 text-xs disabled:opacity-50 transition-all font-medium"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-900">
                {modal === "crear" ? "Agregar insumo" : "Editar insumo"}
              </h2>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Código IGSS</label>
                  <input className="input" type="number" value={form.codigo_igss}
                    onChange={e => setF("codigo_igss", e.target.value)} placeholder="Ej: 2269" />
                </div>
                <div>
                  <label className="label">Código PPR</label>
                  <input className="input" type="number" value={form.codigo_ppr}
                    onChange={e => setF("codigo_ppr", e.target.value)} placeholder="Ej: 1941" />
                </div>
              </div>
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={form.nombre}
                  onChange={e => setF("nombre", e.target.value)} placeholder="Nombre del insumo o servicio" />
              </div>
              <div>
                <label className="label">Características</label>
                <textarea className="input" rows={2} value={form.caracteristicas}
                  onChange={e => setF("caracteristicas", e.target.value)}
                  placeholder="Ej: Concentración: 500mg; Forma: Tableta" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Presentación</label>
                  <input className="input" value={form.presentacion}
                    onChange={e => setF("presentacion", e.target.value)} placeholder="Ej: Caja (100 unidades)" />
                </div>
                <div>
                  <label className="label">Renglón</label>
                  <input className="input" type="number" value={form.renglon}
                    onChange={e => setF("renglon", e.target.value)} placeholder="Ej: 266" />
                </div>
              </div>
            </div>
            {error && (
              <div className="mx-5 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}
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
