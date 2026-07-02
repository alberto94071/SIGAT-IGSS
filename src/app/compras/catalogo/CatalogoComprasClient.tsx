"use client";
import { useState, useMemo, useEffect } from "react";
import { BookOpen, Search, Plus, X, Loader2, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { crearInsumoCompras } from "./actions";

type Insumo = {
  id: number;
  ug: number | null;
  cc: number | null;
  estructura_programatica: string | null;
  codigo_igss: string | null;
  nombre: string;
  codigo_nombre_ppr: number | null;
  nombre_ppr: string | null;
  codigo_presentacion_ppr: number | null;
  unidad_medida: string | null;
  renglon: number | null;
  subproducto: string;
  cantidad: number | null;
  precio_estimado: number | null;
  monto: number | null;
};

const Q = (n: number) =>
  `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const HEADERS = [
  "UG", "C.C.", "Estructura Programática", "Código IGSS",
  "Nombre Genérico, Forma, Concentración y Presentación",
  "Código Nombre PpR", "Nombre PpR", "Código Presentación PpR",
  "Unidad de Medida", "Renglón", "Sub-Producto",
  "Cantidad", "Precio Estimado", "Monto",
];

const PAGE_SIZES = [10, 25, 50] as const;

interface Props { insumos: Insumo[]; }

export default function CatalogoComprasClient({ insumos: init }: Props) {
  const [insumos, setInsumos] = useState(init);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return insumos;
    const q = query.toLowerCase();
    return insumos.filter(i =>
      i.nombre.toLowerCase().includes(q) ||
      (i.codigo_igss ?? "").toLowerCase().includes(q) ||
      i.subproducto.toLowerCase().includes(q) ||
      (i.estructura_programatica ?? "").includes(q) ||
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
    setInsumos(p => [nuevo, ...p]);
    setModal(false);
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
          <button onClick={() => setModal(true)} className="btn-primary shrink-0">
            <Plus className="w-4 h-4" /> Agregar insumo
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="table-header">
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
                  <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap">{i.ug ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap">{i.cc ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap font-mono">{i.estructura_programatica ?? "—"}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-brand-700 whitespace-nowrap">{i.codigo_igss ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-900 min-w-[280px] max-w-[380px]">
                    <p className="line-clamp-2">{i.nombre}</p>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap">{i.codigo_nombre_ppr ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600 min-w-[200px] max-w-[300px]">
                    <p className="line-clamp-2">{i.nombre_ppr ?? "—"}</p>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap">{i.codigo_presentacion_ppr ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{i.unidad_medida ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-700 whitespace-nowrap">{i.renglon ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-gray-700 whitespace-nowrap">{i.subproducto}</td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-900 font-semibold whitespace-nowrap">
                    {i.cantidad?.toLocaleString("es-GT") ?? "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right text-gray-700 whitespace-nowrap">
                    {i.precio_estimado != null ? Q(i.precio_estimado) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right font-bold text-green-700 whitespace-nowrap">
                    {i.monto != null ? Q(i.monto) : "—"}
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

      {modal && <AgregarInsumoModal onClose={() => setModal(false)} onCreado={handleCreado} />}
    </div>
  );
}

function AgregarInsumoModal({ onClose, onCreado }: { onClose: () => void; onCreado: (i: Insumo) => void }) {
  const [nombre, setNombre] = useState("");
  const [subproducto, setSubproducto] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [unidadMedida, setUnidadMedida] = useState("");
  const [codigoIgss, setCodigoIgss] = useState("");
  const [codigoPpr, setCodigoPpr] = useState("");
  const [renglon, setRenglon] = useState("");
  const [avanzado, setAvanzado] = useState(false);
  const [ug, setUg] = useState("");
  const [cc, setCc] = useState("");
  const [estructura, setEstructura] = useState("");
  const [codigoNombrePpr, setCodigoNombrePpr] = useState("");
  const [nombrePpr, setNombrePpr] = useState("");
  const [codigoPresentacionPpr, setCodigoPresentacionPpr] = useState("");
  const [precioEstimado, setPrecioEstimado] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleGuardar() {
    const cantidadNum = parseFloat(cantidad);
    if (!nombre.trim()) return setError("El nombre es obligatorio");
    if (!subproducto.trim()) return setError("El subproducto es obligatorio");
    if (!(cantidadNum > 0)) return setError("Ingresa una cantidad válida");

    setSaving(true); setError("");
    const res = await crearInsumoCompras({
      nombre: nombre.trim(),
      subproducto: subproducto.trim(),
      cantidad: cantidadNum,
      unidad_medida: unidadMedida.trim() || null,
      codigo_igss: codigoIgss.trim() || null,
      codigo_ppr: codigoPpr.trim() || null,
      renglon: renglon ? parseInt(renglon, 10) : null,
      ug: ug ? parseInt(ug, 10) : null,
      cc: cc ? parseInt(cc, 10) : null,
      estructura_programatica: estructura.trim() || null,
      codigo_nombre_ppr: codigoNombrePpr ? parseInt(codigoNombrePpr, 10) : null,
      nombre_ppr: nombrePpr.trim() || null,
      codigo_presentacion_ppr: codigoPresentacionPpr ? parseInt(codigoPresentacionPpr, 10) : null,
      precio_estimado: precioEstimado ? parseFloat(precioEstimado) : null,
    });
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onCreado(res.insumo as unknown as Insumo);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Agregar insumo al catálogo</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="label">Nombre <span className="text-red-500 font-semibold">*</span></label>
            <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre genérico, forma, concentración y presentación" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Código IGSS</label>
              <input className="input font-mono" value={codigoIgss} onChange={e => setCodigoIgss(e.target.value)} />
            </div>
            <div>
              <label className="label">Código PPR</label>
              <input className="input font-mono" value={codigoPpr} onChange={e => setCodigoPpr(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Subproducto <span className="text-red-500 font-semibold">*</span></label>
              <input className="input font-mono" value={subproducto} onChange={e => setSubproducto(e.target.value)} placeholder="001-004-0001" />
            </div>
            <div>
              <label className="label">Unidad de medida</label>
              <input className="input" value={unidadMedida} onChange={e => setUnidadMedida(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">UG</label>
                  <input type="number" className="input" value={ug} onChange={e => setUg(e.target.value)} />
                </div>
                <div>
                  <label className="label">C.C.</label>
                  <input type="number" className="input" value={cc} onChange={e => setCc(e.target.value)} />
                </div>
                <div>
                  <label className="label">Precio estimado</label>
                  <input type="number" step="0.01" className="input" value={precioEstimado} onChange={e => setPrecioEstimado(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Estructura Programática</label>
                <input className="input font-mono" value={estructura} onChange={e => setEstructura(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Código Nombre PpR</label>
                  <input type="number" className="input" value={codigoNombrePpr} onChange={e => setCodigoNombrePpr(e.target.value)} />
                </div>
                <div>
                  <label className="label">Código Presentación PpR</label>
                  <input type="number" className="input" value={codigoPresentacionPpr} onChange={e => setCodigoPresentacionPpr(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Nombre PpR</label>
                <input className="input" value={nombrePpr} onChange={e => setNombrePpr(e.target.value)} />
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
