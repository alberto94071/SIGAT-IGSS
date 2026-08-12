"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Search, Plus, X, Loader2, ChevronLeft, ChevronRight, ChevronDown, Download, Edit2, Trash2, CheckCircle2 } from "lucide-react";
import { crearInsumoCompras, editarInsumoCompras, eliminarInsumoCompras, buscarInsumosCentral, type InsumoCentralAgrupado } from "./actions";
import { importarPac2026 } from "./importar-action";

type Insumo = {
  id: number;
  codigo_igss: string | null;
  nombre: string;
  renglon: number | null;
  subproducto: string;
  cantidad: number | null;
  precio_estimado: number | null;
  monto: number | null;
};

const Q = (n: number) =>
  `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const HEADERS = [
  "Renglón", "Código IGSS",
  "Nombre Genérico, Forma, Concentración y Presentación",
  "Sub-Producto", "Cantidad",
  "Precio Estimado", "Monto", "Acciones"
];

const PAGE_SIZES = [10, 25, 50] as const;

interface Props { insumos: Insumo[]; }

export default function CatalogoComprasClient({ insumos: init }: Props) {
  const router = useRouter();
  const [insumos, setInsumos] = useState(init);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [importando, setImportando] = useState(false);

  // insumos vive en estado local (para que crear/editar/eliminar un insumo
  // se sienta instantáneo) — pero tras reemplazar todo el catálogo
  // (importarPac2026 + router.refresh) hay que resincronizarlo con lo que
  // trae el server component, o la lista en pantalla se queda con los datos
  // viejos hasta que alguien recargue la página a mano.
  useEffect(() => { setInsumos(init); }, [init]);

  async function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("¿Estás seguro de reemplazar todo el catálogo con los datos del archivo seleccionado? Esta acción no se puede deshacer.")) return;
    
    setImportando(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await importarPac2026(formData);
    setImportando(false);
    e.target.value = ""; // Reset input

    if ("error" in res) { alert("Error al importar: " + res.error); return; }
    if (res.advertencia) alert(res.advertencia);
    else alert(`¡Catálogo importado con éxito! (${res.importadas.toLocaleString("es-GT")} insumos)`);
    router.refresh();
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return insumos;
    const q = query.toLowerCase();
    return insumos.filter(i =>
      i.nombre.toLowerCase().includes(q) ||
      (i.codigo_igss ?? "").toLowerCase().includes(q) ||
      i.subproducto.toLowerCase().includes(q) ||
      String(i.renglon ?? "").includes(q)
    );
  }, [insumos, query]);

  useEffect(() => { setPage(1); }, [query, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (pageClamped - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageClamped, pageSize]);

  function handleCreado(nuevo: Insumo) {
    if (editingInsumo) {
      setInsumos(p => p.map(i => i.id === nuevo.id ? nuevo : i));
    } else {
      setInsumos(p => [nuevo, ...p]);
    }
    setModal(false);
    setEditingInsumo(null);
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Seguro que quieres eliminar este insumo del catálogo?")) return;
    const res = await eliminarInsumoCompras(id);
    if ("error" in res) return alert(res.error);
    setInsumos(p => p.filter(i => i.id !== id));
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> PAC 2026 — Catálogo de Insumos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length.toLocaleString("es-GT")} de {insumos.length.toLocaleString("es-GT")} insumos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Buscar por nombre, código IGSS, subproducto…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <label className={`btn-secondary shrink-0 text-brand-600 ${importando ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {importando ? "Importando..." : "Importar PAC 2026"}
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportar} disabled={importando} />
          </label>
          <button onClick={() => { setEditingInsumo(null); setModal(true); }} className="btn-primary shrink-0">
            <Plus className="w-4 h-4" /> Agregar insumo
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-xs">
            <thead>
              <tr className="table-header sticky top-0 bg-white z-10 shadow-sm">
                {HEADERS.map(h => (
                  <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map(i => (
                <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap text-center">{i.renglon ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-green-600 whitespace-nowrap">{i.codigo_igss ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-900 min-w-[280px] max-w-[380px]">
                    <p className="line-clamp-2">{i.nombre}</p>
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-[150px] truncate" title={i.subproducto}>{i.subproducto}</td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-900 font-semibold whitespace-nowrap">
                    {i.cantidad?.toLocaleString("es-GT") ?? "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-700 whitespace-nowrap">
                    {i.precio_estimado != null ? Q(i.precio_estimado) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right font-bold text-green-700 whitespace-nowrap">
                    {i.monto != null ? Q(i.monto) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => { setEditingInsumo(i); setModal(true); }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar insumo"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(i.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar insumo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No se encontraron insumos con ese criterio.</p>
            </div>
          )}
        </div>

        {/* Paginación */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Mostrar</span>
              <div className="relative">
                <select
                  className="input py-1 pl-2 pr-7 text-xs appearance-none"
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                >
                  {PAGE_SIZES.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
              <span>por página</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                Página <strong className="text-gray-700">{pageClamped}</strong> de {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={pageClamped <= 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={pageClamped >= totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {modal && <InsumoModal insumo={editingInsumo} onClose={() => { setModal(false); setEditingInsumo(null); }} onCreado={handleCreado} />}
    </div>
  );
}

function InsumoModal({ insumo, onClose, onCreado }: { insumo: Insumo | null; onClose: () => void; onCreado: (i: Insumo) => void }) {
  const [nombre, setNombre] = useState(insumo?.nombre || "");
  const [subproducto, setSubproducto] = useState(insumo?.subproducto || "");
  const [cantidad, setCantidad] = useState(insumo?.cantidad?.toString() || "");
  const [codigoIgss, setCodigoIgss] = useState(insumo?.codigo_igss || "");
  const [renglon, setRenglon] = useState(insumo?.renglon?.toString() || "");
  const [avanzado, setAvanzado] = useState(false);
  const [precioEstimado, setPrecioEstimado] = useState(insumo?.precio_estimado?.toString() || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Solo se puede elegir un insumo que ya exista en Base de Datos Central —
  // si no está ahí, es que no existe. Con un insumo ya elegido (nuevo o al
  // editar uno existente) se puede "Cambiar insumo" para volver a buscar.
  const [buscando, setBuscando] = useState(!insumo);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<InsumoCentralAgrupado[]>([]);
  const [buscandoLoading, setBuscandoLoading] = useState(false);

  useEffect(() => {
    if (!buscando || query.trim().length < 2) { setResultados([]); return; }
    let vivo = true;
    setBuscandoLoading(true);
    const t = setTimeout(() => {
      buscarInsumosCentral(query).then(r => { if (vivo) { setResultados(r); setBuscandoLoading(false); } });
    }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [query, buscando]);

  function elegirInsumo(r: InsumoCentralAgrupado) {
    setNombre(r.descripcion_igss || r.nombre);
    setCodigoIgss(r.codigo);
    setRenglon(r.renglon != null ? String(r.renglon) : "");
    setBuscando(false); setQuery(""); setResultados([]);
  }

  async function handleGuardar() {
    const cantidadNum = parseFloat(cantidad);
    if (!codigoIgss.trim()) return setError("Elige el insumo desde Base de Datos Central");
    if (!subproducto.trim()) return setError("El subproducto es obligatorio");
    if (!(cantidadNum > 0)) return setError("Ingresa una cantidad válida");

    setSaving(true); setError("");

    const payload = {
      nombre: nombre.trim(),
      subproducto: subproducto.trim(),
      cantidad: cantidadNum,
      codigo_igss: codigoIgss.trim() || null,
      renglon: renglon ? parseInt(renglon, 10) : null,
      precio_estimado: precioEstimado ? parseFloat(precioEstimado) : null,
    };

    const res = insumo
      ? await editarInsumoCompras(insumo.id, payload)
      : await crearInsumoCompras(payload);

    setSaving(false);
    if ("error" in res) return setError(res.error);

    if (insumo) {
      onCreado({ ...insumo, ...payload, monto: payload.precio_estimado ? payload.precio_estimado * payload.cantidad : null });
    } else {
      // @ts-expect-error res.insumo exists when creating
      onCreado(res.insumo as unknown as Insumo);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">{insumo ? "Editar insumo" : "Agregar insumo al catálogo"}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="label">Insumo (Base de Datos Central) <span className="text-red-500 font-semibold">*</span></label>
            {buscando ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className="input pl-9" autoFocus value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Busca por nombre, código o característica…" />
                </div>
                {buscandoLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                {!buscandoLoading && query.trim().length >= 2 && resultados.length === 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    No existe en Base de Datos Central. Si es un insumo nuevo, primero regístralo ahí.
                  </p>
                )}
                {resultados.length > 0 && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-gray-100">
                    {resultados.map(r => (
                      <button key={r.codigo} type="button" onClick={() => elegirInsumo(r)}
                        className="w-full text-left px-3 py-2 hover:bg-brand-50 transition-colors">
                        <p className="text-sm text-gray-900">{r.descripcion_igss || r.nombre}</p>
                        <p className="text-xs text-gray-400 font-mono">Código {r.codigo}{r.renglon != null ? ` · Renglón ${r.renglon}` : ""}</p>
                      </button>
                    ))}
                  </div>
                )}
                {codigoIgss && (
                  <button type="button" onClick={() => setBuscando(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar búsqueda</button>
                )}
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" /> {nombre}
                  </p>
                  <p className="text-xs text-gray-400 font-mono">Código {codigoIgss}{renglon ? ` · Renglón ${renglon}` : ""}</p>
                </div>
                <button type="button" onClick={() => setBuscando(true)} className="text-xs font-medium text-brand-600 hover:text-brand-700 shrink-0">Cambiar</button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Subproducto <span className="text-red-500 font-semibold">*</span></label>
              <input className="input font-mono" value={subproducto} onChange={e => setSubproducto(e.target.value)} placeholder="001-004-0001" />
            </div>
            <div>
              <label className="label">Cantidad autorizada <span className="text-red-500 font-semibold">*</span></label>
              <input type="number" step="0.01" min="0.01" className="input" value={cantidad} onChange={e => setCantidad(e.target.value)} />
            </div>
            <div>
              <label className="label">Renglón</label>
              <input type="number" className="input" value={renglon} onChange={e => setRenglon(e.target.value)} />
            </div>
          </div>

          <button type="button" onClick={() => setAvanzado(p => !p)}
            className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${avanzado ? "rotate-180" : ""}`} />
            Datos PAC (opcional)
          </button>

          {avanzado && (
            <div className="space-y-3 border-t border-gray-100 pt-3">
              <div>
                <label className="label">Precio estimado</label>
                <input type="number" step="0.01" className="input" value={precioEstimado} onChange={e => setPrecioEstimado(e.target.value)} />
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Guardar insumo
          </button>
        </div>
      </div>
    </div>
  );
}
