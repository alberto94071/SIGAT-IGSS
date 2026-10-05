"use client";
import { fechaGuatemala, fechaHoraGuatemala } from "@/lib/date-utils";

import { Fragment, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  FileText, Plus, ChevronDown, ChevronRight, Search, X,
  Trash2, History, ClipboardList,
  Loader2, Printer, XCircle,
  Pencil, Info,
} from "lucide-react";
import {
  eliminarSolicitud, aprobarSolicitud, rechazarSolicitud,
} from "./actions";

// "Generar/Editar solicitud A-01 SIAF" (el item builder completo) se carga
// aparte, no en el bundle inicial de esta página — era, con margen, la pieza
// más grande de este componente, y el cliente reportó (2026-09-30) "lag" al
// cambiar a esta pestaña (y a Catálogo, con el mismo problema — ver el mismo
// tratamiento ahí). `ssr: false` porque solo aparece tras una acción del
// usuario (abrir "Generar A-01 SIAF" o "Editar").
const GenerarSiafModal = dynamic(() => import("./GenerarSiafModal"), { ssr: false });

// Únicos estados que requieren acción en esta pantalla — el resto (Aprobado,
// Consolidado, Adjudicado, Orden de Compra) ya "salió" de aquí y se sigue
// desde /compras/consolidacion o la Hoja de Ruta.
const ACCIONABLES = ["Borrador", "Rechazado"];

export type SolicitudItem = {
  id: number; solicitud_id: number; catalogo_id: number | null;
  codigo_igss: string | null; codigo_ppr: string | null;
  nombre: string; descripcion_igss: string | null; subproducto: string; unidad_medida: string | null;
  cantidad_antes: number | null; cantidad_solicitada: number;
};
export type Solicitud = {
  id: number; numero: number; anio: number; fecha: string; estado: string;
  observaciones: string | null;
  motivo_rechazo: string | null;
  rechazado_por_nombre: string | null;
  rechazado_en: string | null;
  items: SolicitudItem[];
};
export type CatEntry = {
  id: number; codigo_igss: string | null; codigo_ppr: string | null;
  nombre: string; descripcion_igss: string | null; subproducto: string; unidad_medida: string | null;
  cantidad: number | null; renglon: number | null;
};
export type ModalItem = {
  key: number; catalogo_id: number;
  codigo_igss: string | null; codigo_ppr: string | null;
  nombre: string; descripcion_igss: string | null; subproducto: string; unidad_medida: string | null;
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

interface Props {
  solicitudes: Solicitud[]; catalogo: CatEntry[]; canEdit: boolean; firmantes?: Firmante[];
  currentUserName?: string; verInicial?: number | null; pprSugerido?: Record<number, string>;
}

export default function SiafClient({
  solicitudes: initSol, catalogo, canEdit, firmantes = [], currentUserName, verInicial,
  pprSugerido = {},
}: Props) {
  const router = useRouter();
  const [solicitudes,  setSolicitudes]  = useState(initSol);
  const [viewMode,     setViewMode]     = useState<"solicitudes" | "historial">("solicitudes");
  const [query,        setQuery]        = useState("");
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  // Modal imprimir
  const [printModal,   setPrintModal]   = useState(false);
  const [printSolId,   setPrintSolId]   = useState<number | null>(null);
  const [printFecha,   setPrintFecha]   = useState(fechaGuatemala());
  const [selFirmante1, setSelFirmante1] = useState<Firmante | null>(null);
  const [selFirmante2, setSelFirmante2] = useState<Firmante | null>(null);

  // Modal rechazar (siempre pide justificación)
  const [rechazarModal,   setRechazarModal]   = useState(false);
  const [rechazarSolId,   setRechazarSolId]   = useState<number | null>(null);
  const [rechazarMotivo,  setRechazarMotivo]  = useState("");
  const [rechazarLoading, setRechazarLoading] = useState(false);
  const [rechazarError,   setRechazarError]   = useState("");

  // Modal ver motivo de rechazo
  const [motivoModal, setMotivoModal] = useState(false);
  const [motivoSol,   setMotivoSol]   = useState<Solicitud | null>(null);

  // Modal crear / editar — el estado del formulario en sí (fecha,
  // justificación, item builder) ahora vive dentro de GenerarSiafModal.tsx
  // (cargado aparte, ver el comentario de arriba); acá solo queda si está
  // visible y, en modo edición, qué solicitud se está editando.
  const [modal,      setModal]      = useState(false);
  const [editingSol, setEditingSol] = useState<Solicitud | null>(null);

  // ─── Computed ──────────────────────────────────────────────────────────────

  const filteredSolicitudes = useMemo(() => {
    if (!query.trim()) return solicitudes.filter(s => ACCIONABLES.includes(s.estado));
    // Con búsqueda activa, ya no se restringe a ACCIONABLES — reportado por
    // el cliente 2026-10-05 (seguimiento del fix de Historial insumo): esta
    // pestaña es la que se ve primero al entrar, y sigue siendo donde la
    // mayoría escribe el correlativo sin pensar en cambiar de pestaña —
    // "sigue sin mostrármelo... tengo que buscarlo hasta encontrarlo". Un
    // SIAF ya Aprobado/Consolidado/etc. ahora sí aparece al buscarlo por
    // número, aunque ya no sea accionable (la fila se renderiza de solo
    // lectura, ver el badge de estado más abajo en vez de los botones
    // Aprobar/Rechazar).
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
      // El correlativo/fecha/estado se comparan a nivel de SOLICITUD, no de
      // ítem — si no, buscar "119" nunca matcheaba la SIAF 119/2026 cuando
      // ya no es Borrador/Rechazado (ej. Aprobado), porque esta vista es la
      // ÚNICA que incluye todos los estados — "Por solicitud" sí busca por
      // correlativo pero solo entre las accionables (ver ACCIONABLES arriba).
      // Reportado por el cliente 2026-10-05: el buscador nunca encontraba un
      // SIAF ya aprobado, solo apareció scrolleando historial a mano.
      const matchSolicitud = !q ||
        `${sol.numero}/${sol.anio}`.includes(q) ||
        sol.fecha.includes(q) ||
        sol.estado.toLowerCase().includes(q);
      for (const item of sol.items) {
        if (q && !matchSolicitud && !item.nombre.toLowerCase().includes(q) &&
            !(item.codigo_ppr ?? "").toLowerCase().includes(q) &&
            !String(item.codigo_igss ?? "").toLowerCase().includes(q)) continue;
        const key = item.catalogo_id ? String(item.catalogo_id) : `${item.codigo_igss}::${item.subproducto}::${item.nombre}`;
        if (!groups.has(key)) {
          groups.set(key, { key, codigo_igss: item.codigo_igss, nombre: item.nombre,
            subproducto: item.subproducto, unidad_medida: item.unidad_medida, entries: [] });
        }
        groups.get(key)!.entries.push({ sol, item });
      }
    }

    return Array.from(groups.values()).map(g => {
      const cat = catalogo.find(c => (g.key && String(c.id) === g.key) || (c.codigo_igss === g.codigo_igss && c.subproducto === g.subproducto && c.nombre === g.nombre));
      const total_sol = g.entries.reduce((s, e) => s + e.item.cantidad_solicitada, 0);
      const autorizado = cat?.cantidad ?? 0;
      const sorted = [...g.entries].sort((a, b) => b.sol.fecha.localeCompare(a.sol.fecha));
      return { ...g, autorizado, total_solicitado: total_sol, renglon: cat?.renglon ?? null,
        disponible: autorizado - total_sol, entries: sorted };
    });
  }, [solicitudes, catalogo, query]);

  // Buscar un correlativo puntual (ej. "119/2026") en Historial solo acota a
  // UN grupo de insumo colapsado — sin esto, "encontrarlo" seguía significando
  // un clic extra para expandirlo. Se auto-expande solo cuando la búsqueda deja
  // exactamente un grupo, para no pisar un expand manual con varios resultados.
  useEffect(() => {
    if (viewMode !== "historial" || !query.trim()) return;
    if (historialData.length === 1) setExpandedId(historialData[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, viewMode, historialData.length]);

  // Mismo criterio en "Por solicitud": si la búsqueda deja una sola
  // solicitud (ej. buscar un correlativo exacto), se expande sola.
  useEffect(() => {
    if (viewMode !== "solicitudes" || !query.trim()) return;
    if (filteredSolicitudes.length === 1) setExpandedId(String(filteredSolicitudes[0].id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, viewMode, filteredSolicitudes.length]);

  const renglonPorItem = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const c of catalogo) {
      map.set(String(c.id), c.renglon);
      map.set(`${c.codigo_igss}::${c.subproducto}::${c.nombre}`, c.renglon);
      if (c.codigo_igss) map.set(`${c.codigo_igss}::${c.subproducto}`, c.renglon);
    }
    return map;
  }, [catalogo]);

  // Al llegar desde una notificación (?ver=id) — expande la solicitud y, si fue
  // rechazada, muestra de una vez el motivo del rechazo.
  useEffect(() => {
    if (verInicial == null) return;
    const sol = solicitudes.find(s => s.id === verInicial);
    if (!sol) return;
    setExpandedId(String(sol.id));
    if (sol.estado === "Rechazado") {
      setMotivoSol(sol);
      setMotivoModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verInicial]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function openModal() {
    setEditingSol(null);
    setModal(true);
  }

  function openEdit(sol: Solicitud) {
    setEditingSol(sol);
    setModal(true);
  }

  function toggleExpand(id: string) {
    setExpandedId(p => p === id ? null : id);
  }

  function openPrint(id: number) {
    const sol = solicitudes.find(s => s.id === id);
    setPrintSolId(id); setSelFirmante1(null); setSelFirmante2(null);
    setPrintFecha(sol?.fecha || fechaGuatemala());
    setPrintModal(true);
  }

  function goToPrint() {
    if (!printSolId) return;
    const params = [selFirmante1?.id, selFirmante2?.id].filter(Boolean).join(",");
    router.push(`/compras/a01-siaf/${printSolId}/imprimir?firmantes=${params}&fecha=${printFecha}`);
    setPrintModal(false);
  }

  async function handleEliminar(id: number) {
    if (!confirm("¿Eliminar esta solicitud y todos sus ítems?")) return;
    await eliminarSolicitud(id);
    setSolicitudes(p => p.filter(s => s.id !== id));
    router.refresh();
  }

  async function handleAprobar(id: number) {
    const res = await aprobarSolicitud(id);
    if ("error" in res) { alert(res.error); return; }
    setSolicitudes(p => p.map(s => s.id === id ? { ...s, estado: "Aprobado" } : s));
    router.refresh();
  }

  function openRechazar(id: number) {
    setRechazarSolId(id); setRechazarMotivo(""); setRechazarError(""); setRechazarModal(true);
  }

  async function confirmRechazar() {
    if (!rechazarSolId) return;
    const motivo = rechazarMotivo.trim();
    if (!motivo) { setRechazarError("El motivo del rechazo es obligatorio"); return; }
    setRechazarLoading(true);
    setRechazarError("");
    const res = await rechazarSolicitud(rechazarSolId, motivo);
    setRechazarLoading(false);
    if (res.error) { setRechazarError(res.error); return; }
    const ahora = fechaHoraGuatemala();
    setSolicitudes(p => p.map(s => s.id === rechazarSolId
      ? { ...s, estado: "Rechazado", motivo_rechazo: motivo, rechazado_por_nombre: currentUserName ?? null, rechazado_en: ahora }
      : s));
    setRechazarModal(false);
  }

  function openMotivo(sol: Solicitud) {
    setMotivoSol(sol); setMotivoModal(true);
  }

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
            {solicitudes.filter(s => ACCIONABLES.includes(s.estado)).length} pendiente(s) de acción
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            placeholder={viewMode === "solicitudes" ? "Buscar por correlativo, insumo…" : "Buscar por correlativo, insumo o código PPR…"}
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
                      <tr
                        className="border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50"
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {!ACCIONABLES.includes(s.estado) ? (
                              // Ya salió de esta bandeja (Aprobado/Consolidado/...) — solo
                              // aparece acá porque matcheó la búsqueda (ver filteredSolicitudes).
                              // De solo lectura, mismo badge que ya usa Historial insumo —
                              // ofrecer Aprobar/Rechazar sobre un estado que ya avanzó no
                              // tiene sentido y el servidor lo rechazaría de todas formas.
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${ESTADO_STYLE[s.estado] ?? "bg-gray-100 text-gray-600"}`}>
                                {s.estado}
                              </span>
                            ) : s.estado === "Rechazado" ? (
                              <>
                                <button onClick={() => openMotivo(s)}
                                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                  title="Ver motivo del rechazo">
                                  <XCircle className="w-3 h-3" /> Rechazado <Info className="w-3 h-3 opacity-60" />
                                </button>
                                <button
                                  onClick={() => handleAprobar(s.id)}
                                  className="text-xs font-medium px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                                  Aprobar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => openRechazar(s.id)}
                                  className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
                                  Rechazar
                                </button>
                                <button
                                  onClick={() => handleAprobar(s.id)}
                                  className="text-xs font-medium px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                                  Aprobar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openPrint(s.id)}
                                className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                title="Imprimir A-01 SIAF">
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              {ACCIONABLES.includes(s.estado) && (
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
                                      <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Código IGSS</th>
                                      <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">PPR</th>
                                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Insumo</th>
                                      <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Subproducto</th>
                                      <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Renglón</th>
                                      <th className="px-3 py-2 text-right font-semibold text-gray-500 whitespace-nowrap">Antes</th>
                                      <th className="px-3 py-2 text-right font-semibold text-yellow-700 whitespace-nowrap">Solicitado</th>
                                      <th className="px-3 py-2 text-right font-semibold text-green-700 whitespace-nowrap">Disponible</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 bg-white">
                                    {s.items.map(item => {
                                      const despues = item.cantidad_antes != null
                                        ? item.cantidad_antes - item.cantidad_solicitada : null;
                                      const renglon = item.catalogo_id
                                        ? renglonPorItem.get(String(item.catalogo_id))
                                        : (renglonPorItem.get(`${item.codigo_igss}::${item.subproducto}::${item.nombre}`) ?? renglonPorItem.get(`${item.codigo_igss}::${item.subproducto}`));
                                      return (
                                        <tr key={item.id}>
                                          <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{item.codigo_igss ?? "—"}</td>
                                          <td className="px-3 py-2 font-mono whitespace-nowrap">
                                            {item.codigo_ppr ?? (
                                              pprSugerido[item.id]
                                                ? <span className="italic text-gray-400" title="PPR sugerido — se confirma al pasar por Consolidación">{pprSugerido[item.id]} (sugerido)</span>
                                                : <span className="text-gray-600">—</span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 font-medium text-gray-900">{item.nombre}</td>
                                          <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{item.subproducto}</td>
                                          <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap">{renglon ?? "—"}</td>
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
                  <th className="px-4 py-3 text-left whitespace-nowrap">Código IGSS</th>
                  <th className="px-4 py-3 text-left">Insumo</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Subproducto</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Renglón</th>
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
                        <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{g.codigo_igss ?? "—"}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{g.nombre}</p>
                          <p className="text-xs text-gray-400">{g.entries.length} solicitud(es)</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{g.subproducto}</td>
                        <td className="px-4 py-3 tabular-nums text-gray-600 whitespace-nowrap">{g.renglon ?? "—"}</td>
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
                          <td colSpan={8} className="px-6 py-4">
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
              <div>
                <label className="label">Fecha a imprimir</label>
                <input type="date" className="input" value={printFecha} onChange={e => setPrintFecha(e.target.value)} />
              </div>
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

      {/* ── Modal: Rechazar solicitud (siempre pide justificación) ── */}
      {rechazarModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" /> Rechazar solicitud
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Debes indicar el motivo del rechazo</p>
              </div>
              <button onClick={() => setRechazarModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="label">
                  Motivo del rechazo <span className="text-red-500 font-semibold">*</span>
                </label>
                <textarea
                  className="input min-h-[90px] resize-none text-sm"
                  placeholder="Explica por qué se rechaza esta solicitud…"
                  value={rechazarMotivo}
                  onChange={e => setRechazarMotivo(e.target.value)}
                  autoFocus
                />
              </div>
              {rechazarError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {rechazarError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setRechazarModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={confirmRechazar} disabled={rechazarLoading || !rechazarMotivo.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                {rechazarLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Rechazando…</>
                  : <><XCircle className="w-4 h-4" /> Confirmar rechazo</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Ver motivo de rechazo ── */}
      {motivoModal && motivoSol && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" /> SIAF {motivoSol.numero}/{motivoSol.anio} — Rechazado
                </h2>
              </div>
              <button onClick={() => setMotivoModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Motivo del rechazo</p>
                <p className="text-gray-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
                  {motivoSol.motivo_rechazo || "—"}
                </p>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                <span>Rechazado por: <strong className="text-gray-700">{motivoSol.rechazado_por_nombre ?? "—"}</strong></span>
                <span>{motivoSol.rechazado_en ?? ""}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setMotivoModal(false)} className="btn-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Generar A-01 SIAF ── */}
      {modal && (
        <GenerarSiafModal
          editingSol={editingSol}
          catalogo={catalogo}
          solicitudes={solicitudes}
          onClose={() => setModal(false)}
          onCreated={sol => { setSolicitudes(p => [sol, ...p]); router.refresh(); }}
          onUpdated={(id, fecha, observaciones, items) => {
            setSolicitudes(p => p.map(s => s.id === id ? { ...s, fecha, observaciones, items } : s));
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
