"use client";
import { Fragment, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Plus, ChevronDown, ChevronRight, Search, X,
  Trash2, History, ClipboardList, AlertTriangle, CheckCircle2,
  Loader2, Package, Printer,
} from "lucide-react";
import {
  crearSolicitud, eliminarSolicitud, actualizarEstado, getNextSiafNumeroCompras,
} from "./actions";

type SolicitudItem = {
  id: number; solicitud_id: number; catalogo_id: number | null;
  codigo_igss: number | null; codigo_ppr: string | null;
  nombre: string; subproducto: string; unidad_medida: string | null;
  cantidad_antes: number | null; cantidad_solicitada: number;
};
type Solicitud = {
  id: number; numero: number; anio: number; fecha: string; estado: string;
  items: SolicitudItem[];
};
type CatEntry = {
  id: number; codigo_igss: number | null; codigo_ppr: string | null;
  nombre: string; subproducto: string; unidad_medida: string | null;
  cantidad: number | null;
};
type ModalItem = {
  key: number; catalogo_id: number;
  codigo_igss: number | null; codigo_ppr: string | null;
  nombre: string; subproducto: string; unidad_medida: string | null;
  cantidad_solicitada: number;
};

const ESTADO_STYLE: Record<string, string> = {
  "Borrador":  "bg-gray-100 text-gray-600",
  "Enviado":   "bg-blue-100 text-blue-700",
  "Aprobado":  "bg-green-100 text-green-700",
  "Rechazado": "bg-red-100 text-red-700",
};

type Firmante = { id: number; nombre: string; cargo: string };

interface Props { solicitudes: Solicitud[]; catalogo: CatEntry[]; canEdit: boolean; firmantes?: Firmante[]; }

export default function SiafClient({ solicitudes: initSol, catalogo, canEdit, firmantes = [] }: Props) {
  const router = useRouter();
  const [solicitudes,  setSolicitudes]  = useState(initSol);
  const [viewMode,     setViewMode]     = useState<"solicitudes" | "historial">("solicitudes");
  const [query,        setQuery]        = useState("");
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  // Modal imprimir
  const [printModal,   setPrintModal]   = useState(false);
  const [printSolId,   setPrintSolId]   = useState<number | null>(null);
  const [selFirmante1, setSelFirmante1] = useState<Firmante | null>(null);
  const [selFirmante2, setSelFirmante2] = useState<Firmante | null>(null);

  // Modal crear
  const [modal,        setModal]        = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [modalError,   setModalError]   = useState("");
  const [newFecha,     setNewFecha]     = useState(new Date().toISOString().slice(0, 10));
  const [nextNumero,   setNextNumero]   = useState<number | null>(null);
  const [corrLoading,  setCorrLoading]  = useState(false);
  const [modalItems,   setModalItems]   = useState<ModalItem[]>([]);

  // Item builder
  const [itemSearch,   setItemSearch]   = useState("");
  const [showItemDrop, setShowItemDrop] = useState(false);
  const [selCodigo,    setSelCodigo]    = useState<number | null>(null);
  const [selCatEntry,  setSelCatEntry]  = useState<CatEntry | null>(null);
  const [itemCantidad, setItemCantidad] = useState("");

  // ─── Computed ──────────────────────────────────────────────────────────────

  const filteredSolicitudes = useMemo(() => {
    if (!query.trim()) return solicitudes;
    const q = query.toLowerCase();
    return solicitudes.filter(s =>
      `${s.numero}/${s.anio}`.includes(q) ||
      s.fecha.includes(q) ||
      s.estado.toLowerCase().includes(q) ||
      s.items.some(i => i.nombre.toLowerCase().includes(q) || (i.codigo_ppr ?? "").toLowerCase().includes(q))
    );
  }, [solicitudes, query]);

  const historialData = useMemo(() => {
    const q = query.toLowerCase().trim();
    const groups = new Map<string, {
      key: string; codigo_igss: number | null; nombre: string;
      subproducto: string; unidad_medida: string | null;
      entries: { sol: Solicitud; item: SolicitudItem }[];
    }>();

    for (const sol of solicitudes) {
      for (const item of sol.items) {
        if (q && !item.nombre.toLowerCase().includes(q) &&
            !(item.codigo_ppr ?? "").toLowerCase().includes(q) &&
            !String(item.codigo_igss ?? "").includes(query)) continue;
        const key = `${item.codigo_igss}::${item.subproducto}`;
        if (!groups.has(key)) {
          groups.set(key, { key, codigo_igss: item.codigo_igss, nombre: item.nombre,
            subproducto: item.subproducto, unidad_medida: item.unidad_medida, entries: [] });
        }
        groups.get(key)!.entries.push({ sol, item });
      }
    }

    return Array.from(groups.values()).map(g => {
      const cat = catalogo.find(c => c.codigo_igss === g.codigo_igss && c.subproducto === g.subproducto);
      const total_sol = g.entries.reduce((s, e) => s + e.item.cantidad_solicitada, 0);
      const autorizado = cat?.cantidad ?? 0;
      const sorted = [...g.entries].sort((a, b) => b.sol.fecha.localeCompare(a.sol.fecha));
      return { ...g, autorizado, total_solicitado: total_sol,
        disponible: autorizado - total_sol, entries: sorted };
    });
  }, [solicitudes, catalogo, query]);

  // Autocomplete: insumos únicos del catálogo
  const insumoSugg = useMemo(() => {
    if (!itemSearch || itemSearch.length < 1) return [];
    const q = itemSearch.toLowerCase();
    const seen = new Set<number | null>();
    const res: CatEntry[] = [];
    for (const c of catalogo) {
      const ok = c.nombre.toLowerCase().includes(q) ||
        String(c.codigo_igss ?? "").includes(itemSearch) ||
        (c.codigo_ppr ?? "").toLowerCase().includes(q);
      if (ok && !seen.has(c.codigo_igss)) { seen.add(c.codigo_igss); res.push(c); }
    }
    return res.slice(0, 8);
  }, [itemSearch, catalogo]);

  // Subproductos del insumo seleccionado
  const subprodEntries = useMemo(() =>
    selCodigo == null ? [] : catalogo.filter(c => c.codigo_igss === selCodigo),
    [selCodigo, catalogo]
  );

  // Disponible para el entry seleccionado (descontando solicitudes previas + modal actual)
  const disponibleActual = useMemo(() => {
    if (!selCatEntry) return null;
    const autorizado = selCatEntry.cantidad ?? 0;
    const enDB = solicitudes.flatMap(s => s.items)
      .filter(i => i.codigo_igss === selCatEntry.codigo_igss && i.subproducto === selCatEntry.subproducto)
      .reduce((sum, i) => sum + i.cantidad_solicitada, 0);
    const enModal = modalItems
      .filter(i => i.codigo_igss === selCatEntry.codigo_igss && i.subproducto === selCatEntry.subproducto)
      .reduce((sum, i) => sum + i.cantidad_solicitada, 0);
    return autorizado - enDB - enModal;
  }, [selCatEntry, solicitudes, modalItems]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function openModal() {
    setModal(true); setModalItems([]); setModalError("");
    setNewFecha(new Date().toISOString().slice(0, 10));
    setItemSearch(""); setSelCodigo(null); setSelCatEntry(null); setItemCantidad("");
    setCorrLoading(true);
    const n = await getNextSiafNumeroCompras();
    setNextNumero(n); setCorrLoading(false);
  }

  function toggleExpand(id: string) {
    setExpandedId(p => p === id ? null : id);
  }

  function agregarItemModal() {
    if (!selCatEntry || !itemCantidad) return;
    const qty = parseFloat(itemCantidad);
    if (isNaN(qty) || qty <= 0) return;
    setModalItems(p => [...p, {
      key: Date.now(), catalogo_id: selCatEntry.id,
      codigo_igss: selCatEntry.codigo_igss, codigo_ppr: selCatEntry.codigo_ppr,
      nombre: selCatEntry.nombre, subproducto: selCatEntry.subproducto,
      unidad_medida: selCatEntry.unidad_medida, cantidad_solicitada: qty,
    }]);
    setItemSearch(""); setSelCodigo(null); setSelCatEntry(null); setItemCantidad("");
  }

  async function handleGuardar() {
    if (modalItems.length === 0) return setModalError("Agrega al menos un insumo a la solicitud");
    setSaving(true);
    const res = await crearSolicitud({
      fecha: newFecha,
      items: modalItems.map(i => ({
        catalogo_id: i.catalogo_id, codigo_igss: i.codigo_igss,
        codigo_ppr: i.codigo_ppr, nombre: i.nombre, subproducto: i.subproducto,
        unidad_medida: i.unidad_medida, cantidad_solicitada: i.cantidad_solicitada,
      })),
    });
    setSaving(false);
    if (res.error) return setModalError(res.error);
    setSolicitudes(p => [res.solicitud!, ...p] as unknown as Solicitud[]);
    setModal(false);
  }

  function openPrint(id: number) {
    setPrintSolId(id); setSelFirmante1(null); setSelFirmante2(null); setPrintModal(true);
  }

  function goToPrint() {
    if (!printSolId) return;
    const params = [selFirmante1?.id, selFirmante2?.id].filter(Boolean).join(",");
    router.push(`/compras/a01-siaf/${printSolId}/imprimir?firmantes=${params}`);
    setPrintModal(false);
  }

  async function handleEliminar(id: number) {
    if (!confirm("¿Eliminar esta solicitud y todos sus ítems?")) return;
    await eliminarSolicitud(id);
    setSolicitudes(p => p.filter(s => s.id !== id));
  }

  async function handleEstado(id: number, estado: string) {
    await actualizarEstado(id, estado);
    setSolicitudes(p => p.map(s => s.id === id ? { ...s, estado } : s));
  }

  const currentYear = new Date().getFullYear();
  const nextCorrLabel = corrLoading ? "calculando…"
    : nextNumero != null ? `${nextNumero}/${currentYear}` : "—";

  // ─── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Solicitudes A-01 SIAF
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {solicitudes.length} solicitud(es) · {solicitudes.reduce((n, s) => n + s.items.length, 0)} líneas de insumo
          </p>
        </div>
        {canEdit && (
          <button onClick={openModal} className="btn-primary">
            <Plus className="w-4 h-4" /> Generar A-01 SIAF
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9"
            placeholder={viewMode === "solicitudes" ? "Buscar por correlativo, insumo…" : "Buscar insumo o código PPR…"}
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
          <button onClick={() => setViewMode("solicitudes")}
            className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${viewMode === "solicitudes" ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            <ClipboardList className="w-4 h-4" /> Por solicitud
          </button>
          <button onClick={() => setViewMode("historial")}
            className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${viewMode === "historial" ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            <History className="w-4 h-4" /> Historial insumo
          </button>
        </div>
      </div>

      {/* ── Vista A: por solicitud ── */}
      {viewMode === "solicitudes" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Correlativo</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Ítems</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                  {canEdit && <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>}
                </tr>
              </thead>
              <tbody>
                {filteredSolicitudes.map(s => {
                  const rowId = String(s.id);
                  const expanded = expandedId === rowId;
                  return (
                    <Fragment key={s.id}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => toggleExpand(rowId)}>
                        <td className="px-4 py-3 text-gray-400">
                          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                          {s.numero}/{s.anio}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.fecha}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                            {s.items.length}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <select value={s.estado}
                            onChange={e => handleEstado(s.id, e.target.value)}
                            className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 outline-none cursor-pointer ${ESTADO_STYLE[s.estado] ?? "bg-gray-100 text-gray-600"}`}>
                            {["Borrador", "Enviado", "Aprobado", "Rechazado"].map(e => (
                              <option key={e}>{e}</option>
                            ))}
                          </select>
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openPrint(s.id)}
                                className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                title="Imprimir A-01 SIAF">
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleEliminar(s.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                      {expanded && (
                        <tr className="bg-brand-50/40">
                          <td colSpan={canEdit ? 6 : 5} className="px-6 py-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                              Insumos en la solicitud {s.numero}/{s.anio}
                            </p>
                            {s.items.length === 0 ? (
                              <p className="text-sm text-gray-400">Sin ítems</p>
                            ) : (
                              <div className="overflow-x-auto rounded-xl border border-gray-200">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Insumo</th>
                                      <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Subproducto</th>
                                      <th className="px-3 py-2 text-right font-semibold text-gray-500 whitespace-nowrap">Antes</th>
                                      <th className="px-3 py-2 text-right font-semibold text-yellow-700 whitespace-nowrap">Solicitado</th>
                                      <th className="px-3 py-2 text-right font-semibold text-green-700 whitespace-nowrap">Disponible</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 bg-white">
                                    {s.items.map(item => {
                                      const despues = item.cantidad_antes != null
                                        ? item.cantidad_antes - item.cantidad_solicitada : null;
                                      return (
                                        <tr key={item.id}>
                                          <td className="px-3 py-2 font-medium text-gray-900">{item.nombre}</td>
                                          <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{item.subproducto}</td>
                                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                                            {item.cantidad_antes?.toLocaleString("es-GT") ?? "—"}
                                          </td>
                                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-yellow-700">
                                            {item.cantidad_solicitada.toLocaleString("es-GT")}
                                          </td>
                                          <td className={`px-3 py-2 text-right tabular-nums font-bold ${despues != null && despues < 0 ? "text-red-600" : "text-green-700"}`}>
                                            {despues?.toLocaleString("es-GT") ?? "—"}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {filteredSolicitudes.length === 0 && (
              <div className="text-center py-12 text-gray-400">No hay solicitudes</div>
            )}
          </div>
        </div>
      )}

      {/* ── Vista B: historial por insumo ── */}
      {viewMode === "historial" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3 text-left">Insumo</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Subproducto</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Autorizado</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap text-yellow-700">Solicitado</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap text-green-700">Disponible</th>
                </tr>
              </thead>
              <tbody>
                {historialData.map(g => {
                  const expanded = expandedId === g.key;
                  return (
                    <Fragment key={g.key}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => toggleExpand(g.key)}>
                        <td className="px-4 py-3 text-gray-400">
                          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{g.nombre}</p>
                          <p className="text-xs text-gray-400">{g.entries.length} solicitud(es)</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{g.subproducto}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700 whitespace-nowrap">
                          {g.autorizado.toLocaleString("es-GT")}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-yellow-700 whitespace-nowrap">
                          {g.total_solicitado.toLocaleString("es-GT")}
                        </td>
                        <td className={`px-4 py-3 text-right tabular-nums font-bold whitespace-nowrap ${g.disponible < 0 ? "text-red-600" : "text-green-700"}`}>
                          {g.disponible.toLocaleString("es-GT")}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-brand-50/40">
                          <td colSpan={6} className="px-6 py-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                              Historial — {g.nombre} / {g.subproducto}
                            </p>
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">SIAF</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Fecha</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Estado</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-500 whitespace-nowrap">Antes</th>
                                    <th className="px-3 py-2 text-right font-semibold text-yellow-700 whitespace-nowrap">Solicitado</th>
                                    <th className="px-3 py-2 text-right font-semibold text-green-700 whitespace-nowrap">Después</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                  {g.entries.map(({ sol, item }, idx) => {
                                    const despues = item.cantidad_antes != null
                                      ? item.cantidad_antes - item.cantidad_solicitada : null;
                                    return (
                                      <tr key={idx}>
                                        <td className="px-3 py-2 font-mono font-bold text-gray-900 whitespace-nowrap">
                                          {sol.numero}/{sol.anio}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{sol.fecha}</td>
                                        <td className="px-3 py-2">
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ESTADO_STYLE[sol.estado] ?? "bg-gray-100 text-gray-600"}`}>
                                            {sol.estado}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                                          {item.cantidad_antes?.toLocaleString("es-GT") ?? "—"}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-yellow-700">
                                          {item.cantidad_solicitada.toLocaleString("es-GT")}
                                        </td>
                                        <td className={`px-3 py-2 text-right tabular-nums font-bold ${despues != null && despues < 0 ? "text-red-600" : "text-green-700"}`}>
                                          {despues?.toLocaleString("es-GT") ?? "—"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {historialData.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                {query.trim() ? "No se encontró ese insumo" : "No hay historial aún"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Seleccionar firmantes para imprimir ── */}
      {printModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">Imprimir A-01 SIAF</h2>
                <p className="text-xs text-gray-500 mt-0.5">Selecciona los firmantes del documento</p>
              </div>
              <button onClick={() => setPrintModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {[
                { label: "Firmante 1 (izquierda)", val: selFirmante1, set: setSelFirmante1 },
                { label: "Firmante 2 (derecha)",   val: selFirmante2, set: setSelFirmante2 },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="label">{label}</label>
                  <select className="input"
                    value={val?.id ?? ""}
                    onChange={e => {
                      const f = firmantes.find(f => f.id === Number(e.target.value)) ?? null;
                      set(f);
                    }}>
                    <option value="">— Sin firmante —</option>
                    {firmantes.map(f => (
                      <option key={f.id} value={f.id}>{f.nombre} — {f.cargo}</option>
                    ))}
                  </select>
                </div>
              ))}
              {firmantes.length === 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  No hay firmantes configurados. El superadmin debe agregarlos en Configuración → Firmantes.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setPrintModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={goToPrint} className="btn-primary">
                <Printer className="w-4 h-4" /> Abrir para imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Generar A-01 SIAF ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-semibold text-gray-900">Generar solicitud A-01 SIAF</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Correlativo:{" "}
                  {corrLoading
                    ? <span className="text-gray-400 animate-pulse">calculando…</span>
                    : <strong className="text-brand-700">{nextCorrLabel}</strong>}
                </p>
              </div>
              <button onClick={() => setModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">

              {/* Fecha */}
              <div className="max-w-xs">
                <label className="label">Fecha de la solicitud</label>
                <input className="input" type="date" value={newFecha}
                  onChange={e => setNewFecha(e.target.value)} />
              </div>

              {/* Item builder */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/60">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Agregar insumo a la solicitud
                </p>

                {/* Buscar insumo */}
                <div className="relative">
                  <label className="label">Insumo (nombre o código IGSS)</label>
                  <div className="relative">
                    <input className="input pr-8" value={itemSearch}
                      onChange={e => { setItemSearch(e.target.value); setSelCodigo(null); setSelCatEntry(null); setShowItemDrop(true); }}
                      onFocus={() => itemSearch.length >= 1 && setShowItemDrop(true)}
                      onBlur={() => setTimeout(() => setShowItemDrop(false), 180)}
                      placeholder="Escribe nombre o código IGSS…" />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  {showItemDrop && insumoSugg.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                      {insumoSugg.map((c, i) => (
                        <button key={i} type="button"
                          onMouseDown={() => { setSelCodigo(c.codigo_igss); setItemSearch(c.nombre); setSelCatEntry(null); setShowItemDrop(false); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-brand-50 border-b border-gray-50 last:border-0">
                          <p className="text-sm font-medium text-gray-900">{c.nombre}</p>
                          <p className="text-xs text-gray-400">IGSS: {c.codigo_igss ?? "—"} · PPR: {c.codigo_ppr ?? "—"}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {showItemDrop && itemSearch.length >= 1 && insumoSugg.length === 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 text-sm text-gray-400">
                      No está en el catálogo de la unidad.
                    </div>
                  )}
                </div>

                {/* Subproducto (aparece tras seleccionar insumo) */}
                {selCodigo != null && (
                  <div>
                    <label className="label">Subproducto</label>
                    <select className="input"
                      value={selCatEntry?.id ?? ""}
                      onChange={e => { setSelCatEntry(subprodEntries.find(c => c.id === Number(e.target.value)) ?? null); setItemCantidad(""); }}>
                      <option value="">— Selecciona subproducto —</option>
                      {subprodEntries.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.subproducto} · Autorizado: {c.cantidad?.toLocaleString("es-GT") ?? "?"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Disponible + Cantidad (aparece tras seleccionar subproducto) */}
                {selCatEntry && (
                  <>
                    <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm ${
                      disponibleActual != null && disponibleActual <= 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
                    }`}>
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        Dispone de{" "}
                        <strong>{disponibleActual?.toLocaleString("es-GT") ?? "—"}</strong>{" "}
                        {selCatEntry.unidad_medida ?? "unidades"} para <strong>{selCatEntry.subproducto}</strong>
                      </span>
                    </div>
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="label">Cantidad a solicitar</label>
                        <input className="input" type="number" step="0.01" min="1"
                          value={itemCantidad} onChange={e => setItemCantidad(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && agregarItemModal()}
                          placeholder="0" />
                      </div>
                      <button onClick={agregarItemModal}
                        disabled={!itemCantidad || parseFloat(itemCantidad) <= 0}
                        className="btn-primary h-10 px-4 mb-0">
                        <Plus className="w-4 h-4" /> Agregar
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Lista de ítems agregados */}
              {modalItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-3.5 h-3.5" />
                    Insumos en esta solicitud ({modalItems.length})
                  </p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {modalItems.map(item => (
                      <div key={item.key} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 bg-white">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.nombre}</p>
                          <p className="text-xs text-gray-400 font-mono">{item.subproducto}</p>
                        </div>
                        <p className="text-sm font-bold text-brand-700 tabular-nums whitespace-nowrap">
                          {item.cantidad_solicitada.toLocaleString("es-GT")} {item.unidad_medida ?? "u."}
                        </p>
                        <button onClick={() => setModalItems(p => p.filter(i => i.key !== item.key))}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {modalError && (
              <div className="mx-5 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {modalError}
              </div>
            )}

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleGuardar}
                disabled={saving || modalItems.length === 0}
                className="btn-primary">
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
                  : <><CheckCircle2 className="w-4 h-4" /> Guardar solicitud</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
