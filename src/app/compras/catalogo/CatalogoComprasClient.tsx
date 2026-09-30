"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { BookOpen, Search, Plus, Loader2, ChevronLeft, ChevronRight, ChevronDown, Download, Edit2, Trash2, HelpCircle, ListFilter } from "lucide-react";
import { eliminarInsumoCompras } from "./actions";
import { importarPac2026 } from "./importar-action";

// Los 3 modales de esta pantalla (Instructivo/Resultado de importar/Agregar-
// editar insumo) se cargan aparte (`CatalogoModals.tsx`), no en el bundle
// inicial de la página — entre los 3 eran más de la mitad de este archivo,
// y el cliente reportó (2026-09-30) que cambiar a esta pestaña (y a A-01
// SIAF, con el mismo problema) tenía un "lag" notorio comparado con las
// demás pestañas de Compras — confirmado midiendo bytes de JS transferidos
// por navegación: Catálogo/A-01 SIAF eran, por un margen claro, los 2
// archivos de cliente más grandes del módulo. `ssr: false` porque ninguno
// de los 3 hace falta en el HTML inicial (solo aparecen tras una acción del
// usuario — abrir "Agregar insumo", "Instructivo", o tras importar).
const InsumoModal = dynamic(() => import("./CatalogoModals").then(m => m.InsumoModal), { ssr: false });
const InstructivoPacModal = dynamic(() => import("./CatalogoModals").then(m => m.InstructivoPacModal), { ssr: false });
const ResultadoImportarModal = dynamic(() => import("./CatalogoModals").then(m => m.ResultadoImportarModal), { ssr: false });

export type Insumo = {
  id: number;
  codigo_igss: string | null;
  nombre: string;
  descripcion_igss: string | null;
  renglon: number | null;
  subproducto: string;
  codigo_ppr: string;
  cantidad: number | null;
  precio_estimado: number | null;
  monto: number | null;
};

const Q = (n: number) =>
  `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const HEADERS = [
  "Renglón", "Código IGSS", "PPR",
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
  const [renglonFiltro, setRenglonFiltro] = useState<number | "sin" | null>(null);
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [importando, setImportando] = useState(false);
  const [mostrarInstructivo, setMostrarInstructivo] = useState(false);
  const [resultadoImport, setResultadoImport] = useState<
    { tipo: "ok"; importadas: number } | { tipo: "advertencia"; importadas: number; mensaje: string } | { tipo: "error"; mensaje: string } | null
  >(null);

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

    if ("error" in res) { setResultadoImport({ tipo: "error", mensaje: res.error ?? "Error desconocido al importar el archivo." }); return; }
    if (res.advertencia) setResultadoImport({ tipo: "advertencia", importadas: res.importadas, mensaje: res.advertencia });
    else setResultadoImport({ tipo: "ok", importadas: res.importadas });
    router.refresh();
  }

  // Renglones que ya tienen al menos un insumo en el catálogo — para que el
  // usuario vea de un vistazo cuáles ya agregó (y por descarte, a cuáles les
  // falta agregar presupuesto todavía). Ordenados numéricamente, con la
  // cantidad de insumos de cada uno.
  const renglonesDisponibles = useMemo(() => {
    const conteo = new Map<number, number>();
    let sinRenglon = 0;
    for (const i of insumos) {
      if (i.renglon == null) { sinRenglon++; continue; }
      conteo.set(i.renglon, (conteo.get(i.renglon) ?? 0) + 1);
    }
    return {
      renglones: [...conteo.entries()].sort((a, b) => a[0] - b[0]),
      sinRenglon,
    };
  }, [insumos]);

  const filtered = useMemo(() => {
    let base = insumos;
    if (renglonFiltro === "sin") base = base.filter(i => i.renglon == null);
    else if (renglonFiltro != null) base = base.filter(i => i.renglon === renglonFiltro);

    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(i =>
      i.nombre.toLowerCase().includes(q) ||
      (i.codigo_igss ?? "").toLowerCase().includes(q) ||
      i.codigo_ppr.toLowerCase().includes(q) ||
      i.subproducto.toLowerCase().includes(q) ||
      String(i.renglon ?? "").includes(q)
    );
  }, [insumos, query, renglonFiltro]);

  useEffect(() => { setPage(1); }, [query, pageSize, renglonFiltro]);

  // Suma de Cantidad/Monto de TODOS los insumos filtrados (no solo la
  // página visible) — para que, al filtrar por un renglón, se vea de una
  // vez cuánto se lleva usado del presupuesto de ese renglón, sin tener
  // que sumar a mano insumo por insumo.
  const totalesFiltro = useMemo(() => {
    if (renglonFiltro == null) return null;
    return {
      count: filtered.length,
      cantidad: filtered.reduce((s, i) => s + (i.cantidad ?? 0), 0),
      monto: filtered.reduce((s, i) => s + (i.monto ?? 0), 0),
    };
  }, [filtered, renglonFiltro]);

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
              placeholder="Buscar por nombre, código IGSS, PPR, subproducto…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="relative">
            <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              className={`input pl-9 pr-7 appearance-none ${renglonFiltro != null ? "border-brand-300 text-brand-700 font-medium" : ""}`}
              value={renglonFiltro ?? ""}
              onChange={e => {
                const v = e.target.value;
                setRenglonFiltro(v === "" ? null : v === "sin" ? "sin" : Number(v));
              }}
              title="Filtrar por renglón — para ver cuáles ya agregaste al catálogo"
            >
              <option value="">Todos los renglones</option>
              {renglonesDisponibles.renglones.map(([renglon, cant]) => (
                <option key={renglon} value={renglon}>Renglón {renglon} ({cant})</option>
              ))}
              {renglonesDisponibles.sinRenglon > 0 && (
                <option value="sin">Sin renglón ({renglonesDisponibles.sinRenglon})</option>
              )}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          <button type="button" onClick={() => setMostrarInstructivo(true)}
            className="btn-secondary shrink-0 text-gray-600" title="Cómo debe estar armado el archivo del PAC">
            <HelpCircle className="w-4 h-4" /> Instructivo
          </button>
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
                  <td className="px-3 py-2 font-mono text-xs text-gray-600 whitespace-nowrap">{i.codigo_ppr || "—"}</td>
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

        {totalesFiltro && (
          <div className="px-4 py-2.5 border-t border-gray-100 bg-brand-50 flex items-center justify-between flex-wrap gap-2 text-sm">
            <span className="font-medium text-brand-700">
              Total {renglonFiltro === "sin" ? "sin renglón" : `renglón ${renglonFiltro}`}
              {" "}({totalesFiltro.count} insumo{totalesFiltro.count === 1 ? "" : "s"})
            </span>
            <div className="flex items-center gap-4 text-brand-700 tabular-nums">
              <span>Cantidad total: <strong>{totalesFiltro.cantidad.toLocaleString("es-GT")}</strong></span>
              <span>Monto total: <strong>{Q(totalesFiltro.monto)}</strong></span>
            </div>
          </div>
        )}

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
      {mostrarInstructivo && <InstructivoPacModal onClose={() => setMostrarInstructivo(false)} />}
      {resultadoImport && <ResultadoImportarModal resultado={resultadoImport} onClose={() => setResultadoImport(null)} onVerInstructivo={() => { setResultadoImport(null); setMostrarInstructivo(true); }} />}
    </div>
  );
}
