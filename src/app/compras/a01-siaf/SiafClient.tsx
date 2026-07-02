"use client";
import { Fragment, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Plus, ChevronDown, ChevronRight, Search, X,
  Trash2, History, ClipboardList, CheckCircle2,
  Loader2, Package, Printer, XCircle, Layers, AlertTriangle, ShoppingCart,
  Pencil, Gavel,
} from "lucide-react";
import {
  crearSolicitud, editarSolicitud, eliminarSolicitud, actualizarEstado,
  getNextSiafNumeroCompras, consolidarSiaf,
} from "./actions";

type SolicitudItem = {
  id: number; solicitud_id: number; catalogo_id: number | null;
  codigo_igss: string | null; codigo_ppr: string | null;
  nombre: string; subproducto: string; unidad_medida: string | null;
  cantidad_antes: number | null; cantidad_solicitada: number;
};
type Solicitud = {
  id: number; numero: number; anio: number; fecha: string; estado: string;
  observaciones: string | null;
  items: SolicitudItem[];
};
type CatEntry = {
  id: number; codigo_igss: string | null; codigo_ppr: string | null;
  nombre: string; subproducto: string; unidad_medida: string | null;
  cantidad: number | null;
};
type ModalItem = {
  key: number; catalogo_id: number;
  codigo_igss: string | null; codigo_ppr: string | null;
  nombre: string; subproducto: string; unidad_medida: string | null;
  cantidad_solicitada: number;
};

const ESTADO_STYLE: Record<string, string> = {
  "Borrador":        "bg-gray-100 text-gray-600",
  "Enviado":         "bg-blue-100 text-blue-700",
  "Aprobado":        "bg-green-100 text-green-700",
  "Rechazado":       "bg-red-100 text-red-700",
  "Consolidado":     "bg-purple-100 text-purple-700",
  "Adjudicado":      "bg-blue-100 text-blue-700",
  "Orden de Compra": "bg-indigo-100 text-indigo-700",
};

type Firmante = { id: number; nombre: string; cargo: string };

interface Props { solicitudes: Solicitud[]; catalogo: CatEntry[]; canEdit: boolean; firmantes?: Firmante[]; }

export default function SiafClient({ solicitudes: initSol, catalogo, canEdit, firmantes = [] }: Props) {
  const router = useRouter();
  const [solicitudes,  setSolicitudes]  = useState(initSol);
  const [viewMode,     setViewMode]     = useState<"solicitudes" | "historial">("solicitudes");
  const [query,        setQuery]        = useState("");
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  // Selección para consolidar
  const [seleccionados,  setSeleccionados]  = useState<Set<number>>(new Set());
  const [consolModal,    setConsolModal]    = useState(false);
  const [consolLoading,  setConsolLoading]  = useState(false);
  const [consolError,    setConsolError]    = useState("");
  const [preOrden,       setPreOrden]       = useState("");

  // Modal imprimir
  const [printModal,   setPrintModal]   = useState(false);
  const [printSolId,   setPrintSolId]   = useState<number | null>(null);
  const [selFirmante1, setSelFirmante1] = useState<Firmante | null>(null);
  const [selFirmante2, setSelFirmante2] = useState<Firmante | null>(null);

  // Modal crear / editar
  const [modal,        setModal]        = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [modalError,   setModalError]   = useState("");
  const [newFecha,         setNewFecha]         = useState(new Date().toISOString().slice(0, 10));
  const [newJustificacion, setNewJustificacion] = useState("");
  const [nextNumero,       setNextNumero]       = useState<number | null>(null);
  const [corrLoading,      setCorrLoading]      = useState(false);
  const [modalItems,       setModalItems]       = useState<ModalItem[]>([]);
  // Modo edición
  const [editMode,      setEditMode]      = useState(false);
  const [editingSolId,  setEditingSolId]  = useState<number | null>(null);
  const [editCorrLabel, setEditCorrLabel] = useState("");

  // Item builder
  const [itemSearch,        setItemSearch]        = useState("");
  const [showItemDrop,      setShowItemDrop]      = useState(false);
  const [selCodigo,         setSelCodigo]         = useState<string | null>(null);
  const [subprodSelections, setSubprodSelections] = useState<Map<number, string>>(new Map());

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
      key: string; codigo_igss: string | null; nombre: string;
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

  const insumoSugg = useMemo(() => {
    if (!itemSearch || itemSearch.length < 1) return [];
    const q = itemSearch.toLowerCase();
    const seen = new Set<string | null>();
    const res: CatEntry[] = [];
    for (const c of catalogo) {
      const ok = c.nombre.toLowerCase().includes(q) ||
        String(c.codigo_igss ?? "").includes(itemSearch) ||
        (c.codigo_ppr ?? "").toLowerCase().includes(q);
      if (ok && !seen.has(c.codigo_igss)) { seen.add(c.codigo_igss); res.push(c); }
    }
    return res.slice(0, 8);
  }, [itemSearch, catalogo]);

  const subprodEntries = useMemo(() =>
    selCodigo == null ? [] : catalogo.filter(c => c.codigo_igss === selCodigo),
    [selCodigo, catalogo]
  );

  // SIAFs seleccionados que son Aprobados (para el modal de confirmación)
  const seleccionadosList = useMemo(() =>
    solicitudes.filter(s => seleccionados.has(s.id)),
    [solicitudes, seleccionados]
  );

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function openModal() {
    setEditMode(false); setEditingSolId(null); setEditCorrLabel("");
    setModal(true); setModalItems([]); setModalError("");
    setNewFecha(new Date().toISOString().slice(0, 10));
    setNewJustificacion("");
    setItemSearch(""); setSelCodigo(null); setSubprodSelections(new Map());
    setCorrLoading(true);
    const n = await getNextSiafNumeroCompras();
    setNextNumero(n); setCorrLoading(false);
  }

  function openEdit(sol: Solicitud) {
    setEditMode(true);
    setEditingSolId(sol.id);
    setEditCorrLabel(`${sol.numero}/${sol.anio}`);
    setModal(true);
    setModalError("");
    setNewFecha(sol.fecha);
    setNewJustificacion(sol.observaciones ?? "");
    setItemSearch(""); setSelCodigo(null); setSubprodSelections(new Map());
    const prefilled: ModalItem[] = sol.items
      .filter(i => i.catalogo_id != null)
      .map(i => ({
        key:                i.id,
        catalogo_id:        i.catalogo_id!,
        codigo_igss:        i.codigo_igss,
        codigo_ppr:         i.codigo_ppr,
        nombre:             i.nombre,
        subproducto:        i.subproducto,
        unidad_medida:      i.unidad_medida,
        cantidad_solicitada: i.cantidad_solicitada,
      }));
    setModalItems(prefilled);
  }

  function toggleExpand(id: string) {
    setExpandedId(p => p === id ? null : id);
  }

  function toggleSeleccion(id: number) {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function agregarItemModal() {
    const newItems: ModalItem[] = [];
    subprodSelections.forEach((cantStr, catId) => {
      const qty = parseFloat(cantStr);
      if (isNaN(qty) || qty <= 0) return;
      const entry = catalogo.find(c => c.id === catId);
      if (!entry) return;
      newItems.push({
        key: Date.now() + catId, catalogo_id: entry.id,
        codigo_igss: entry.codigo_igss, codigo_ppr: entry.codigo_ppr,
        nombre: entry.nombre, subproducto: entry.subproducto,
        unidad_medida: entry.unidad_medida, cantidad_solicitada: qty,
      });
    });
    if (newItems.length === 0) return;
    setModalItems(p => [...p, ...newItems]);
    setItemSearch(""); setSelCodigo(null); setSubprodSelections(new Map());
  }

  async function handleGuardar() {
    if (!newJustificacion.trim()) {
      return setModalError("La justificación es un campo obligatorio para generar la solicitud.");
    }
    if (modalItems.length === 0) return setModalError("Agrega al menos un insumo a la solicitud");
    setSaving(true);

    const itemData = modalItems.map(i => ({
      catalogo_id: i.catalogo_id, codigo_igss: i.codigo_igss,
      codigo_ppr: i.codigo_ppr, nombre: i.nombre, subproducto: i.subproducto,
      unidad_medida: i.unidad_medida, cantidad_solicitada: i.cantidad_solicitada,
    }));

    if (editMode && editingSolId != null) {
      const res = await editarSolicitud(editingSolId, {
        fecha: newFecha,
        observaciones: newJustificacion.trim() || null,
        items: itemData,
      });
      setSaving(false);
      if (res.error) return setModalError(res.error);
      setSolicitudes(p => p.map(s =>
        s.id === editingSolId
          ? { ...s, fecha: newFecha, observaciones: newJustificacion.trim() || null, items: res.solicitud!.items as unknown as SolicitudItem[] }
          : s
      ));
      setModal(false);
    } else {
      const res = await crearSolicitud({ fecha: newFecha, observaciones: newJustificacion.trim() || null, items: itemData });
      setSaving(false);
      if (res.error) return setModalError(res.error);
      setSolicitudes(p => [res.solicitud!, ...p] as unknown as Solicitud[]);
      setModal(false);
    }
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

  async function handleConsolidar() {
    if (seleccionados.size === 0) return;
    if (!/^\d+$/.test(preOrden.trim())) {
      setConsolError("Ingresa un Número de Pre Orden válido (solo dígitos)");
      return;
    }
    setConsolLoading(true);
    setConsolError("");
    const res = await consolidarSiaf([...seleccionados], preOrden.trim());
    setConsolLoading(false);
    if (res.error) { setConsolError(res.error); return; }
    setSolicitudes(p => p.map(s =>
      seleccionados.has(s.id) ? { ...s, estado: "Consolidado" } : s
    ));
    setSeleccionados(new Set());
    setConsolModal(false);
    setPreOrden("");
  }

  const currentYear = new Date().getFullYear();
  const nextCorrLabel = editMode && editCorrLabel
    ? editCorrLabel
    : corrLoading ? "calculando…"
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
        <div className="flex items-center gap-2">
          {seleccionados.size > 0 && (
            <button
              onClick={() => { setConsolError(""); setPreOrden(""); setConsolModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm">
              <Layers className="w-4 h-4" />
              Consolidar ({seleccionados.size})
            </button>
          )}
          {canEdit && (
            <button onClick={openModal} className="btn-primary">
              <Plus className="w-4 h-4" /> Generar A-01 SIAF
            </button>
          )}
        </div>
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
                  <th className="px-4 py-3 text-center whitespace-nowrap w-12">Sel.</th>
                  {canEdit && <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>}
                </tr>
              </thead>
              <tbody>
                {filteredSolicitudes.map(s => {
                  const rowId = String(s.id);
                  const expanded = expandedId === rowId;
                  const finalizado = s.estado === "Aprobado" || s.estado === "Rechazado" || s.estado === "Consolidado" || s.estado === "Adjudicado" || s.estado === "Orden de Compra";
                  const isSelected = seleccionados.has(s.id);
                  const canSelect = s.estado === "Aprobado";
                  return (
                    <Fragment key={s.id}>
                      <tr
                        className={`border-b border-gray-100 cursor-pointer transition-colors
                          ${isSelected
                            ? "bg-purple-50 hover:bg-purple-100"
                            : "hover:bg-gray-50"
                          }`}
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
                          {s.estado === "Consolidado" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                              <Layers className="w-3 h-3" /> Consolidado
                            </span>
                          ) : s.estado === "Adjudicado" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                              <Gavel className="w-3 h-3" /> Adjudicado
                            </span>
                          ) : s.estado === "Orden de Compra" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                              <ShoppingCart className="w-3 h-3" /> Orden de Compra
                            </span>
                          ) : s.estado === "Aprobado" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                              <CheckCircle2 className="w-3 h-3" /> Aprobado
                            </span>
                          ) : s.estado === "Rechazado" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700">
                              <XCircle className="w-3 h-3" /> Rechazado
                            </span>
                          ) : (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleEstado(s.id, "Rechazado")}
                                className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
                                Rechazar
                              </button>
                              <button
                                onClick={() => handleEstado(s.id, "Aprobado")}
                                className="text-xs font-medium px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                                Aprobar
                              </button>
                            </div>
                          )}
                        </td>
                        {/* Columna Selección — solo Aprobado muestra checkbox */}
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          {canSelect && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSeleccion(s.id)}
                              className="w-4 h-4 accent-purple-600 cursor-pointer"
                            />
                          )}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openPrint(s.id)}
                                className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                title="Imprimir A-01 SIAF">
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              {!finalizado && (
                                <>
                                  <button onClick={() => openEdit(s)}
                                    className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                    title="Editar solicitud">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleEliminar(s.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Eliminar solicitud">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      {expanded && (
                        <tr className="bg-brand-50/40">
                          <td colSpan={canEdit ? 7 : 6} className="px-6 py-4">
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

      {/* ── Modal: Confirmar consolidación ── */}
      {consolModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-600" /> Consolidar solicitudes
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Se creará una nueva consolidación</p>
              </div>
              <button onClick={() => setConsolModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-gray-600">
                Vas a consolidar <strong>{seleccionados.size}</strong> solicitud(es) A-01 SIAF:
              </p>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {seleccionadosList.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span className="font-mono font-bold text-gray-900 text-sm">{s.numero}/{s.anio}</span>
                    <span className="text-xs text-gray-400">{s.fecha}</span>
                    <span className="ml-auto text-xs text-gray-400">{s.items.length} ítem(s)</span>
                  </div>
                ))}
              </div>
              <div>
                <label className="label">Número de Pre Orden <span className="text-red-500 font-semibold">*</span></label>
                <input
                  className="input font-mono"
                  inputMode="numeric"
                  value={preOrden}
                  onChange={e => setPreOrden(e.target.value.replace(/\D/g, ""))}
                  placeholder="Ej: 1023"
                  autoFocus
                />
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Al confirmar, estas solicitudes pasarán a estado <strong>Consolidado</strong> de forma permanente. Esta acción no se puede deshacer.
              </div>
              {consolError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {consolError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setConsolModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleConsolidar} disabled={consolLoading || !/^\d+$/.test(preOrden.trim())}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors">
                {consolLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Consolidando…</>
                  : <><Layers className="w-4 h-4" /> Confirmar consolidación</>}
              </button>
            </div>
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
                <h2 className="font-semibold text-gray-900">
                  {editMode ? "Editar solicitud A-01 SIAF" : "Generar solicitud A-01 SIAF"}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Correlativo:{" "}
                  {!editMode && corrLoading
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

              {/* Justificación */}
              <div>
                <label className="label">
                  Justificación <span className="text-red-500 font-semibold">*</span>
                </label>
                <textarea
                  className="input min-h-[56px] resize-none text-sm uppercase"
                  placeholder="SERVICIOS NECESARIOS E INDISPENSABLES PARA BRINDAR ATENCIÓN A LOS PACIENTES…"
                  value={newJustificacion}
                  onChange={e => setNewJustificacion(e.target.value.toUpperCase())}
                />
              </div>

              {/* Item builder */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/60">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Agregar insumo a la solicitud
                </p>

                <div className="relative">
                  <label className="label">Insumo (nombre o código IGSS)</label>
                  <div className="relative">
                    <input className="input pr-8" value={itemSearch}
                      onChange={e => {
                        setItemSearch(e.target.value);
                        setSelCodigo(null);
                        setSubprodSelections(new Map());
                        setShowItemDrop(true);
                      }}
                      onFocus={() => itemSearch.length >= 1 && setShowItemDrop(true)}
                      onBlur={() => setTimeout(() => setShowItemDrop(false), 180)}
                      placeholder="Escribe nombre o código IGSS…" />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  {showItemDrop && insumoSugg.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                      {insumoSugg.map((c, i) => (
                        <button key={i} type="button"
                          onMouseDown={() => {
                            setSelCodigo(c.codigo_igss);
                            setItemSearch(c.nombre);
                            setSubprodSelections(new Map());
                            setShowItemDrop(false);
                          }}
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

                {selCodigo != null && subprodEntries.length > 0 && (
                  <div className="space-y-2">
                    <label className="label">Subproductos — marca los que necesitas y asigna cantidad a cada uno</label>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      {subprodEntries.map(c => {
                        const selQty    = subprodSelections.get(c.id) ?? "";
                        const isChecked = subprodSelections.has(c.id);
                        const autorizado = c.cantidad ?? 0;
                        const enDB = solicitudes.flatMap(s => s.items)
                          .filter(i => i.codigo_igss === c.codigo_igss && i.subproducto === c.subproducto)
                          .reduce((sum, i) => sum + i.cantidad_solicitada, 0);
                        const enModal = modalItems
                          .filter(i => i.codigo_igss === c.codigo_igss && i.subproducto === c.subproducto)
                          .reduce((sum, i) => sum + i.cantidad_solicitada, 0);
                        const disponible = autorizado - enDB - enModal;
                        return (
                          <div key={c.id}
                            className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${isChecked ? "bg-brand-50/60" : "bg-white"}`}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={ev => {
                                const next = new Map(subprodSelections);
                                if (ev.target.checked) next.set(c.id, "");
                                else next.delete(c.id);
                                setSubprodSelections(next);
                              }}
                              className="w-4 h-4 accent-brand-600 shrink-0 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 font-mono">{c.subproducto}</p>
                              <p className={`text-xs ${disponible <= 0 ? "text-red-600" : "text-green-700"}`}>
                                Disponible: <strong>{disponible.toLocaleString("es-GT")}</strong> {c.unidad_medida ?? "u."}
                              </p>
                            </div>
                            {isChecked && (
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className="input w-28 text-right"
                                placeholder="Cantidad"
                                value={selQty}
                                onChange={ev => {
                                  const next = new Map(subprodSelections);
                                  next.set(c.id, ev.target.value);
                                  setSubprodSelections(next);
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {subprodSelections.size > 0 && (
                      <button
                        type="button"
                        onClick={agregarItemModal}
                        disabled={[...subprodSelections.values()].every(v => !v || parseFloat(v) <= 0)}
                        className="btn-primary w-full justify-center">
                        <Plus className="w-4 h-4" />
                        Agregar {subprodSelections.size} subproducto{subprodSelections.size > 1 ? "s" : ""}
                      </button>
                    )}
                  </div>
                )}
              </div>

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
                  : editMode
                    ? <><CheckCircle2 className="w-4 h-4" /> Guardar cambios</>
                    : <><CheckCircle2 className="w-4 h-4" /> Guardar solicitud</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
