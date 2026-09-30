"use client";
import { fechaGuatemala } from "@/lib/date-utils";
import { useState, useMemo, useEffect } from "react";
import { X, ChevronDown, Plus, Package, Loader2, CheckCircle2 } from "lucide-react";
import { crearSolicitud, editarSolicitud, getNextSiafNumeroCompras } from "./actions";
import type { Solicitud, SolicitudItem, CatEntry, ModalItem } from "./SiafClient";

// El modal "Generar/Editar solicitud A-01 SIAF" vive en un archivo aparte,
// cargado con next/dynamic desde SiafClient.tsx — era, con margen, la pieza
// más grande de ese componente (el item builder completo: desplegable de
// insumo, checklist de subproductos, lista de ítems agregados) y no hace
// falta en la carga inicial de la pantalla, solo cuando el usuario realmente
// abre "Generar A-01 SIAF" o "Editar". Mismo motivo que la extracción de los
// modales del Catálogo el mismo día (2026-09-30): el cliente reportó "lag"
// al cambiar a estas dos pestañas específicas de Compras, y ambas eran, por
// un margen claro, los 2 client components más pesados del módulo.

interface Props {
  editingSol: Solicitud | null;
  catalogo: CatEntry[];
  solicitudes: Solicitud[];
  onClose: () => void;
  onCreated: (solicitud: Solicitud) => void;
  onUpdated: (id: number, fecha: string, observaciones: string | null, items: SolicitudItem[]) => void;
}

export default function GenerarSiafModal({ editingSol, catalogo, solicitudes, onClose, onCreated, onUpdated }: Props) {
  const editMode = editingSol != null;
  const editingSolId = editingSol?.id ?? null;
  const editCorrLabel = editingSol ? `${editingSol.numero}/${editingSol.anio}` : "";

  const [saving,     setSaving]     = useState(false);
  const [modalError, setModalError] = useState("");
  const [newFecha,         setNewFecha]         = useState(editingSol?.fecha ?? fechaGuatemala());
  const [newJustificacion, setNewJustificacion] = useState(editingSol?.observaciones ?? "");
  const [nextNumero,       setNextNumero]       = useState<number | null>(null);
  const [corrLoading,      setCorrLoading]      = useState(!editMode);
  const [modalItems, setModalItems] = useState<ModalItem[]>(() =>
    editingSol
      ? editingSol.items.filter(i => i.catalogo_id != null).map(i => ({
          key:                i.id,
          catalogo_id:        i.catalogo_id!,
          codigo_igss:        i.codigo_igss,
          codigo_ppr:         i.codigo_ppr,
          nombre:             i.nombre,
          descripcion_igss:   i.descripcion_igss,
          subproducto:        i.subproducto,
          unidad_medida:      i.unidad_medida,
          cantidad_solicitada: i.cantidad_solicitada,
        }))
      : []
  );

  // Item builder
  const [itemSearch,        setItemSearch]        = useState("");
  const [showItemDrop,      setShowItemDrop]      = useState(false);
  const [selCodigo,         setSelCodigo]         = useState<string | null>(null);
  const [selNombre,         setSelNombre]         = useState<string | null>(null);
  // Presentación/PPR elegida en el desplegable de arriba (2026-09-30) — el
  // checklist de subproductos de abajo se filtra por esto, así que solo
  // sirve para elegir a QUÉ SUBPRODUCTO se le asigna cantidad, no para
  // volver a distinguir presentación ahí también.
  const [selCodigoPpr,      setSelCodigoPpr]      = useState<string | null>(null);
  const [subprodSelections, setSubprodSelections] = useState<Map<number, string>>(new Map());
  // Base de Datos Central (fuente normal de unidad_medida) está vacía en
  // producción — sin este campo manual, todo insumo nuevo queda con
  // unidad_medida null y sale en blanco en el DAB-60/A-04 impreso (ver
  // gruposRenglonDeConsolidacion en renglon-utils.ts, que ya prioriza este
  // snapshot sobre el catálogo cuando existe).
  const [unidadManual,      setUnidadManual]      = useState("");

  useEffect(() => {
    if (editMode) return;
    let vivo = true;
    setCorrLoading(true);
    getNextSiafNumeroCompras().then(n => { if (vivo) { setNextNumero(n); setCorrLoading(false); } });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentYear = new Date().getFullYear();
  const nextCorrLabel = editMode && editCorrLabel
    ? editCorrLabel
    : corrLoading ? "calculando…"
    : nextNumero != null ? `${nextNumero}/${currentYear}` : "—";

  const insumoSugg = useMemo(() => {
    if (!itemSearch || itemSearch.length < 1) return [];
    const q = itemSearch.toLowerCase();
    // Se agrupa por código + nombre + PPR, no solo por código + nombre: dos
    // renglones de PAC del mismo insumo pueden ser presentaciones/PPR
    // distintos (2026-09-30, catalogo_compras.codigo_ppr) — el pedido del
    // cliente es que cada presentación aparezca como su propia opción acá,
    // para elegir la presentación de una vez en este paso (el checklist de
    // abajo ya no vuelve a distinguir presentación, solo subproducto). Los
    // insumos sin código real siguen sin mezclarse entre sí porque
    // comparten el mismo `nombre` en la clave.
    const seen = new Set<string>();
    const res: CatEntry[] = [];
    for (const c of catalogo) {
      const ok = c.nombre.toLowerCase().includes(q) ||
        String(c.codigo_igss ?? "").includes(itemSearch) ||
        (c.codigo_ppr ?? "").toLowerCase().includes(q);
      const key = `${c.codigo_igss}::${c.nombre}::${c.codigo_ppr}`;
      if (ok && !seen.has(key)) { seen.add(key); res.push(c); }
    }
    return res.slice(0, 8);
  }, [itemSearch, catalogo]);

  const subprodEntries = useMemo(() =>
    selCodigo == null ? [] : catalogo.filter(c =>
      c.codigo_igss === selCodigo && c.nombre === selNombre && c.codigo_ppr === selCodigoPpr
    ),
    [selCodigo, selNombre, selCodigoPpr, catalogo]
  );

  function agregarItemModal() {
    const newItems: ModalItem[] = [];
    subprodSelections.forEach((cantStr, catId) => {
      const qty = parseFloat(cantStr);
      if (isNaN(qty) || qty <= 0) return;
      const entry = catalogo.find(c => c.id === catId);
      if (!entry) return;
      newItems.push({
        // codigo_ppr del ítem SIEMPRE arranca null acá, aunque el catálogo ya
        // tenga uno (2026-09-30, catalogo_compras.codigo_ppr) — ese campo es
        // solo para distinguir renglones del PAC por presentación, un
        // concepto distinto del codigo_ppr de siaf_compras_items, que tiene
        // su propio ciclo de vida (arranca null, solo lo llena Consolidación
        // vía guardarPprSeleccion, con un formato de clave compuesta
        // distinto — ver renglon-utils.ts). Propagar el del catálogo acá
        // rompería esa impresión/resolución de PPR más adelante.
        key: Date.now() + catId, catalogo_id: entry.id,
        codigo_igss: entry.codigo_igss, codigo_ppr: null,
        nombre: entry.nombre, descripcion_igss: entry.descripcion_igss, subproducto: entry.subproducto,
        unidad_medida: unidadManual.trim() || entry.unidad_medida, cantidad_solicitada: qty,
      });
    });
    if (newItems.length === 0) return;
    setModalItems(p => [...p, ...newItems]);
    setItemSearch(""); setSelCodigo(null); setSelNombre(null); setSelCodigoPpr(null); setSubprodSelections(new Map()); setUnidadManual("");
  }

  async function handleGuardar() {
    if (!newJustificacion.trim()) {
      return setModalError("La justificación es un campo obligatorio para generar la solicitud.");
    }
    if (modalItems.length === 0) return setModalError("Agrega al menos un insumo a la solicitud");
    setSaving(true);

    const itemData = modalItems.map(i => ({
      catalogo_id: i.catalogo_id, codigo_igss: i.codigo_igss,
      codigo_ppr: i.codigo_ppr, nombre: i.nombre, descripcion_igss: i.descripcion_igss, subproducto: i.subproducto,
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
      onUpdated(editingSolId, newFecha, newJustificacion.trim() || null, res.solicitud!.items as unknown as SolicitudItem[]);
      onClose();
    } else {
      const res = await crearSolicitud({ fecha: newFecha, observaciones: newJustificacion.trim() || null, items: itemData });
      setSaving(false);
      if (res.error) return setModalError(res.error);
      onCreated(res.solicitud! as unknown as Solicitud);
      onClose();
    }
  }

  return (
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
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
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
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 bg-gray-50/60 dark:bg-gray-800">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              Agregar insumo a la solicitud
            </p>

            <div className="relative">
              <label className="label">Insumo (nombre o código IGSS)</label>
              <div className="relative">
                <input className="input pr-8" value={itemSearch}
                  onChange={e => {
                    setItemSearch(e.target.value);
                    setSelCodigo(null);
                    setSelNombre(null);
                    setSelCodigoPpr(null);
                    setSubprodSelections(new Map());
                    setUnidadManual("");
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
                        setSelNombre(c.nombre);
                        setSelCodigoPpr(c.codigo_ppr);
                        setItemSearch(c.nombre);
                        setSubprodSelections(new Map());
                        setUnidadManual(c.unidad_medida ?? "");
                        setShowItemDrop(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-brand-50 border-b border-gray-50 last:border-0">
                      <p className="text-sm font-medium text-gray-900">{c.nombre}</p>
                      {c.descripcion_igss && c.descripcion_igss.trim() !== c.nombre.trim() && (
                        <p className="text-xs text-gray-500">{c.descripcion_igss}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        IGSS: {c.codigo_igss ?? "—"} · {c.codigo_ppr ? `PPR ${c.codigo_ppr}` : "Sin distinguir presentación"}
                      </p>
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
              <div>
                <label className="label">Unidad de medida</label>
                <input className="input" value={unidadManual}
                  onChange={e => setUnidadManual(e.target.value)}
                  placeholder="Ej. Galón, Unidad, Caja…" />
              </div>
            )}

            {selCodigo != null && subprodEntries.length > 0 && (
              <div className="space-y-2">
                <label className="label">Subproductos — marca los que necesitas y asigna cantidad a cada uno</label>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {subprodEntries.map(c => {
                    const selQty    = subprodSelections.get(c.id) ?? "";
                    const isChecked = subprodSelections.has(c.id);
                    const autorizado = c.cantidad ?? 0;
                    const enDB = solicitudes
                      .filter(s => s.estado !== "Rechazado" && (!editMode || s.id !== editingSolId))
                      .flatMap(s => s.items)
                      .filter(i => i.codigo_igss === c.codigo_igss && i.subproducto === c.subproducto && i.nombre === c.nombre)
                      .reduce((sum, i) => sum + i.cantidad_solicitada, 0);
                    const enModal = modalItems
                      .filter(i => i.codigo_igss === c.codigo_igss && i.subproducto === c.subproducto && i.nombre === c.nombre)
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
                            step="1"
                            min="1"
                            max={disponible}
                            className="input w-28 text-right"
                            placeholder="Cantidad"
                            value={selQty}
                            onChange={ev => {
                              const next = new Map(subprodSelections);
                              let val = ev.target.value;
                              if (val && Number(val) > disponible) {
                                val = String(disponible);
                              }
                              next.set(c.id, val);
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
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
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
  );
}
