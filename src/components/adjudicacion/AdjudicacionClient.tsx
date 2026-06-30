"use client";
import { Fragment, useState, useMemo, useEffect, useRef } from "react";
import {
  Gavel, ChevronDown, ChevronRight, Search, FileText,
  X, Loader2, AlertTriangle, CheckCircle2, Building2,
  ShoppingCart, Hash, Calendar, DollarSign, Layers,
} from "lucide-react";
import {
  adjudicar, completarAdjudicacion, anularConsolidacion, buscarProveedoresAuto,
} from "@/lib/adjudicacion/actions";
import {
  TIPOS, REFERENCIA_LABEL, LIMITE_POR_TIPO, type TipoCompra, type Consolidacion, type Proveedor,
} from "@/lib/adjudicacion/types";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ESTADO_COLOR: Record<string, string> = {
  "Pendiente adjudicación":  "bg-amber-100 text-amber-700",
  "Adjudicado":              "bg-blue-100 text-blue-700",
  "Enviado a Fondo Rotativo":"bg-purple-100 text-purple-700",
  "Enviado a Presupuesto":   "bg-indigo-100 text-indigo-700",
  "Orden de Compra Generada":"bg-green-100 text-green-700",
};

const TIPO_COLOR: Record<string, string> = {
  "Compra Directa":     "bg-blue-100 text-blue-700",
  "Baja Cuantía":       "bg-emerald-100 text-emerald-700",
  "Contrato Abierto":   "bg-amber-100 text-amber-700",
  "Casos de Excepción": "bg-orange-100 text-orange-700",
};

function correlativo(c: Consolidacion) {
  if (c.numero_adjudicacion) return `ADJ-${c.numero_adjudicacion}`;
  if (c.pre_orden) return `PRE-${c.pre_orden}`;
  return `${String(c.numero).padStart(3, "0")}/${c.anio}`;
}

type ModalMode = "adjudicar" | "completar";
type ModalCtx = { consolidacion: Consolidacion; mode: ModalMode } | null;

interface Props {
  consolidaciones: Consolidacion[];
  rol: "compras" | "junta";
  canEdit: boolean;
}

export default function AdjudicacionClient({ consolidaciones: init, rol, canEdit }: Props) {
  const [consolidaciones, setConsolidaciones] = useState(init);
  const [query,      setQuery]      = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Modal state
  const [ctx,           setCtx]           = useState<ModalCtx>(null);
  const [step,          setStep]          = useState(0);
  const [tipoCompra,    setTipoCompra]    = useState<TipoCompra | "">("");
  const [nog,           setNog]           = useState("");
  const [fechaEvento,   setFechaEvento]   = useState(new Date().toISOString().slice(0, 10));
  const [numAdj,        setNumAdj]        = useState("");
  const [provQ,         setProvQ]         = useState("");
  const [provSugg,      setProvSugg]      = useState<Proveedor[]>([]);
  const [provSearching, setProvSearching] = useState(false);
  const [provSelected,  setProvSelected]  = useState<Proveedor | null>(null);
  const [showProvDrop,  setShowProvDrop]  = useState(false);
  // Compras completar state
  const [referencia,    setReferencia]    = useState("");
  const [exentoIva,     setExentoIva]     = useState(true);
  const [precioInputs,  setPrecioInputs]  = useState<Map<string, string>>(new Map());
  const [regularizado,  setRegularizado]  = useState<boolean | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [limitExceeded, setLimitExceeded] = useState(false);

  const provTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return consolidaciones;
    return consolidaciones.filter(c =>
      correlativo(c).toLowerCase().includes(q) ||
      c.fecha.includes(q) ||
      (c.tipo_compra ?? "").toLowerCase().includes(q) ||
      (c.pre_orden ?? "").includes(q) ||
      (c.numero_adjudicacion ?? "").includes(q) ||
      c.siaf.some(s => `${s.numero}/${s.anio}`.includes(q))
    );
  }, [consolidaciones, query]);

  useEffect(() => {
    if (provTimer.current) clearTimeout(provTimer.current);
    if (provQ.trim().length < 2) { setProvSugg([]); return; }
    provTimer.current = setTimeout(async () => {
      setProvSearching(true);
      const res = await buscarProveedoresAuto(provQ);
      setProvSugg(res); setProvSearching(false); setShowProvDrop(true);
    }, 300);
  }, [provQ]);

  function resetModal() {
    setStep(0); setTipoCompra(""); setNog("");
    setFechaEvento(new Date().toISOString().slice(0, 10));
    setNumAdj(""); setProvQ(""); setProvSugg([]);
    setProvSelected(null); setShowProvDrop(false);
    setReferencia(""); setExentoIva(true);
    setPrecioInputs(new Map()); setRegularizado(null);
    setError(""); setLimitExceeded(false); setLoading(false);
  }

  function openAdjudicar(c: Consolidacion) { resetModal(); setCtx({ consolidacion: c, mode: "adjudicar" }); }
  function openCompletar(c: Consolidacion) {
    resetModal();
    const initPrecios = new Map<string, string>();
    c.precios.forEach(p => initPrecios.set(`${p.codigo_igss}::${p.subproducto}`, p.precio_unitario?.toString() ?? ""));
    setPrecioInputs(initPrecios);
    setCtx({ consolidacion: c, mode: "completar" });
  }
  function closeModal() { setCtx(null); resetModal(); }

  // ── Totales para modal compras ──
  const totalBruto = useMemo(() => {
    if (!ctx?.consolidacion) return 0;
    let s = 0;
    for (const p of ctx.consolidacion.precios) {
      const val = parseFloat(precioInputs.get(`${p.codigo_igss}::${p.subproducto}`) ?? "0") || 0;
      s += p.cantidad * val;
    }
    return s;
  }, [ctx, precioInputs]);
  const totalFinal = exentoIva ? totalBruto : totalBruto * 0.88;
  const limite = tipoCompra ? LIMITE_POR_TIPO[tipoCompra as TipoCompra] : (ctx?.consolidacion.tipo_compra ? LIMITE_POR_TIPO[ctx.consolidacion.tipo_compra as TipoCompra] : 90000);
  const totalExcede = totalFinal > 0 && totalFinal > limite;
  const tipoCompraActual = ctx?.consolidacion.tipo_compra as TipoCompra | null | undefined;

  // ── Handlers ──
  async function handleAdjudicar() {
    if (!ctx) return;
    if (!tipoCompra) return setError("Selecciona el tipo de compra");
    if (!provSelected) return setError("Selecciona un proveedor");
    if (!/^\d+$/.test(numAdj.trim())) return setError("El Número de Adjudicación solo puede contener dígitos");
    if (tipoCompra === "Compra Directa") {
      if (!nog.trim()) return setError("El NOG es obligatorio");
      if (!fechaEvento) return setError("La fecha de finalización del evento es obligatoria");
    }
    setLoading(true); setError("");
    const res = await adjudicar(ctx.consolidacion.id, {
      tipo_compra: tipoCompra as TipoCompra,
      proveedor_id: provSelected.id,
      proveedor_nit: provSelected.nit ?? "",
      proveedor_nombre: provSelected.nombre,
      numero_adjudicacion: numAdj.trim(),
      nog: tipoCompra === "Compra Directa" ? nog.trim() : undefined,
      fecha_evento: tipoCompra === "Compra Directa" ? fechaEvento : undefined,
    });
    setLoading(false);
    if (res.error) return setError(res.error);
    const destinoAuto = tipoCompra === "Compra Directa" ? "presupuesto" : null;
    setConsolidaciones(p => p.map(c =>
      c.id === ctx.consolidacion.id ? {
        ...c, estado: "Adjudicado", tipo_compra: tipoCompra as TipoCompra,
        proveedor_id: provSelected!.id, proveedor_nit: provSelected!.nit,
        proveedor_nombre: provSelected!.nombre, numero_adjudicacion: numAdj.trim(),
        nog: tipoCompra === "Compra Directa" ? nog.trim() : null,
        fecha_evento: tipoCompra === "Compra Directa" ? fechaEvento : null,
        destino: destinoAuto,
      } : c
    ));
    closeModal();
  }

  async function handleCompletar() {
    if (!ctx) return;
    const tipo = tipoCompraActual;
    if (!tipo) return setError("Tipo de compra no definido");
    const precios = ctx.consolidacion.precios.map(p => ({
      codigo_igss: p.codigo_igss,
      subproducto: p.subproducto,
      precio_unitario: parseFloat(precioInputs.get(`${p.codigo_igss}::${p.subproducto}`) ?? "0") || 0,
    }));
    setLoading(true); setError(""); setLimitExceeded(false);
    const res = await completarAdjudicacion(ctx.consolidacion.id, {
      referencia: tipo !== "Compra Directa" ? referencia.trim() : null,
      exento_iva: exentoIva,
      precios,
      regularizado: tipo !== "Compra Directa" ? regularizado : null,
    });
    setLoading(false);
    if ((res as any).limitExceeded) { setLimitExceeded(true); setError(res.error!); return; }
    if (res.error) return setError(res.error);
    const destino = tipo === "Compra Directa" ? "presupuesto" : (regularizado ? "fondo_rotativo" : "presupuesto");
    const estado  = destino === "fondo_rotativo" ? "Enviado a Fondo Rotativo" : "Enviado a Presupuesto";
    setConsolidaciones(p => p.map(c =>
      c.id === ctx.consolidacion.id ? { ...c, estado, destino, regularizado, total: totalFinal } : c
    ));
    closeModal();
  }

  async function handleAnular() {
    if (!ctx) return;
    setLoading(true); setError("");
    const res = await anularConsolidacion(ctx.consolidacion.id);
    setLoading(false);
    if (res.error) return setError(res.error);
    setConsolidaciones(p => p.filter(c => c.id !== ctx.consolidacion.id));
    closeModal();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Gavel className="w-5 h-5" />
          {rol === "junta" ? "Adjudicaciones — Junta Adjudicadora" : "Adjudicaciones"}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{consolidaciones.length} consolidación(es)</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por Pre Orden, Adj, tipo o SIAF…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Referencia</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Tipo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">SIAFs</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const expanded = expandedId === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(p => p === c.id ? null : c.id)}>
                      <td className="px-4 py-3 text-gray-400">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                        {correlativo(c)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {c.tipo_compra
                          ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLOR[c.tipo_compra] ?? "bg-gray-100 text-gray-600"}`}>{c.tipo_compra}</span>
                          : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.fecha}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">{c.siaf.length}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap max-w-[180px] truncate">
                        {c.proveedor_nombre ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">
                        {c.total != null ? Q(c.total) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${ESTADO_COLOR[c.estado] ?? "bg-gray-100 text-gray-600"}`}>
                          {c.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {/* JUNTA: Adjudicar */}
                        {rol === "junta" && canEdit && c.estado === "Pendiente adjudicación" && (
                          <button onClick={() => openAdjudicar(c)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                            <Gavel className="w-3 h-3" /> Adjudicar
                          </button>
                        )}
                        {/* COMPRAS: Completar Adjudicación (cuando ya adjudicó Junta) */}
                        {rol === "compras" && canEdit && c.estado === "Adjudicado" && (
                          <button onClick={() => openCompletar(c)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                            <ShoppingCart className="w-3 h-3" /> Completar Adjudicación
                          </button>
                        )}
                        {(c.estado === "Orden de Compra Generada") && (
                          <span className="flex items-center gap-1 text-xs text-green-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Generada
                          </span>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-purple-50/30">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* SIAFs */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5" /> SIAFs consolidados
                              </p>
                              <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead><tr className="bg-gray-100">
                                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Correlativo</th>
                                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Fecha</th>
                                    <th className="px-3 py-1.5 text-center font-semibold text-gray-600">Estado</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-gray-100 bg-white">
                                    {c.siaf.map(s => (
                                      <tr key={s.id}>
                                        <td className="px-3 py-2 font-mono font-bold text-gray-900">{s.numero}/{s.anio}</td>
                                        <td className="px-3 py-2 text-gray-600">{s.fecha}</td>
                                        <td className="px-3 py-2 text-center">
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">{s.estado}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            {/* Insumos con precio */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Insumos</p>
                              {c.precios.length > 0 ? (
                                <div className="rounded-xl border border-gray-200 overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead><tr className="bg-gray-100">
                                      <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Insumo</th>
                                      <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Cant.</th>
                                      <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Precio</th>
                                      <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Subtotal</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                      {c.precios.map((p, i) => {
                                        const subtotal = p.precio_unitario != null ? p.cantidad * p.precio_unitario : null;
                                        return (
                                          <tr key={i}>
                                            <td className="px-3 py-2 text-gray-900 font-medium">{p.nombre}<span className="block text-gray-400 font-mono text-[10px]">{p.subproducto}</span></td>
                                            <td className="px-3 py-2 text-right tabular-nums text-gray-600">{p.cantidad.toLocaleString("es-GT")}</td>
                                            <td className="px-3 py-2 text-right tabular-nums text-gray-700">{p.precio_unitario != null ? Q(p.precio_unitario) : "—"}</td>
                                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">{subtotal != null ? Q(subtotal) : "—"}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400">Sin precios registrados aún</p>
                              )}
                              {/* Detalles adicionales */}
                              <div className="mt-3 space-y-1 text-xs text-gray-600">
                                {c.nog && <p><span className="font-semibold">NOG:</span> {c.nog}</p>}
                                {c.fecha_evento && <p><span className="font-semibold">Fecha evento:</span> {c.fecha_evento}</p>}
                                {c.referencia && <p><span className="font-semibold">Referencia:</span> {c.referencia}</p>}
                                {c.numero_adjudicacion && <p><span className="font-semibold">N° Adjudicación:</span> {c.numero_adjudicacion}</p>}
                                {c.proveedor_nombre && <p><span className="font-semibold">Proveedor:</span> {c.proveedor_nombre} {c.proveedor_nit && `· NIT: ${c.proveedor_nit}`}</p>}
                                {c.regularizado !== null && <p><span className="font-semibold">Tipo:</span> {c.regularizado ? "Regularizado" : "Normal"}</p>}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Gavel className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay consolidaciones.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal (shared) ── */}
      {ctx && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Gavel className="w-4 h-4 text-amber-600" />
                  {ctx.mode === "adjudicar" ? "Adjudicar Consolidación" : "Completar Adjudicación"}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">{correlativo(ctx.consolidacion)} · {ctx.consolidacion.siaf.length} SIAF(s)</p>
              </div>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            <div className="px-5 py-5 space-y-5">

              {/* ── JUNTA: paso 0 — tipo de compra ── */}
              {ctx.mode === "adjudicar" && step === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Selecciona el tipo de compra:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {TIPOS.map(t => (
                      <button key={t} onClick={() => setTipoCompra(t)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all ${tipoCompra === t ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 bg-white text-gray-700 hover:border-brand-300"}`}>
                        <Gavel className="w-5 h-5" />{t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── JUNTA: paso 1 — proveedor + N° adjudicación (+ NOG/fecha si CD) ── */}
              {ctx.mode === "adjudicar" && step === 1 && (
                <div className="space-y-4">
                  {/* Proveedor */}
                  <div className="relative">
                    <label className="label flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> NIT o Proveedor <span className="text-red-500">*</span></label>
                    {provSelected ? (
                      <div className="flex items-center justify-between p-3 border border-green-300 bg-green-50 rounded-xl">
                        <div><p className="text-sm font-semibold text-green-900">{provSelected.nombre}</p>
                          <p className="text-xs text-green-700">NIT: {provSelected.nit ?? "—"}</p></div>
                        <button onClick={() => { setProvSelected(null); setProvQ(""); }} className="p-1 text-green-600 hover:text-red-600 rounded-lg"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input className="input pl-9" value={provQ}
                          onChange={e => { setProvQ(e.target.value); setShowProvDrop(true); }}
                          onFocus={() => provSugg.length > 0 && setShowProvDrop(true)}
                          onBlur={() => setTimeout(() => setShowProvDrop(false), 200)}
                          placeholder="Escribe NIT o nombre…" autoFocus />
                        {provSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
                        {showProvDrop && provSugg.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                            {provSugg.map(p => (
                              <button key={p.id} type="button" onMouseDown={() => { setProvSelected(p); setProvQ(p.nombre); setShowProvDrop(false); }}
                                className="w-full text-left px-4 py-2.5 hover:bg-brand-50 border-b border-gray-50 last:border-0">
                                <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                                <p className="text-xs text-gray-400">NIT: {p.nit ?? "—"}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* N° adjudicación SIGES */}
                  <div>
                    <label className="label flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Número de Adjudicación (SIGES) <span className="text-red-500">*</span></label>
                    <input className="input font-mono" value={numAdj}
                      onChange={e => setNumAdj(e.target.value.replace(/\D/g, ""))}
                      placeholder="Solo dígitos" />
                  </div>
                  {/* NOG y fecha solo si Compra Directa */}
                  {tipoCompra === "Compra Directa" && (
                    <>
                      <div>
                        <label className="label flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> NOG <span className="text-red-500">*</span></label>
                        <input className="input font-mono" value={nog} onChange={e => setNog(e.target.value)} placeholder="Ej: 12345678" />
                      </div>
                      <div>
                        <label className="label flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Fecha de finalización del evento <span className="text-red-500">*</span></label>
                        <input className="input" type="date" value={fechaEvento} onChange={e => setFechaEvento(e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── COMPRAS: Completar Adjudicación ── */}
              {ctx.mode === "completar" && (
                <div className="space-y-4">
                  {/* Referencia (no aplica a Compra Directa) */}
                  {tipoCompraActual && tipoCompraActual !== "Compra Directa" && REFERENCIA_LABEL[tipoCompraActual] && (
                    <div>
                      <label className="label">{REFERENCIA_LABEL[tipoCompraActual]} <span className="text-red-500">*</span></label>
                      <input className="input" value={referencia} onChange={e => setReferencia(e.target.value)} />
                    </div>
                  )}
                  {/* Precio por insumo */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" /> Precio por insumo
                    </p>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      {ctx.consolidacion.precios.map((p, i) => {
                        const key = `${p.codigo_igss}::${p.subproducto}`;
                        const val = precioInputs.get(key) ?? "";
                        const precioNum = parseFloat(val) || 0;
                        return (
                          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 bg-white">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{p.nombre}</p>
                              <p className="text-xs text-gray-400 font-mono">{p.subproducto} · {p.cantidad.toLocaleString("es-GT")} {p.unidad_medida ?? "u."}</p>
                            </div>
                            <div className="relative w-28 shrink-0">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">Q</span>
                              <input type="number" step="0.01" min="0.01" className="input pl-6 text-right font-mono text-sm" placeholder="0.00"
                                value={val} onChange={e => setPrecioInputs(prev => { const m = new Map(prev); m.set(key, e.target.value); return m; })} />
                            </div>
                            {precioNum > 0 && <p className="text-xs text-gray-500 whitespace-nowrap">{Q(p.cantidad * precioNum)}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Exento IVA */}
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input type="checkbox" checked={exentoIva} onChange={e => setExentoIva(e.target.checked)} className="w-4 h-4 accent-brand-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Exento de IVA</p>
                      <p className="text-xs text-gray-400">{exentoIva ? "Sin descuento de IVA" : "Se descuenta el 12% del total"}</p>
                    </div>
                  </label>
                  {/* Total */}
                  {totalBruto > 0 && (
                    <div className={`rounded-xl border px-4 py-3 space-y-1.5 ${totalExcede ? "border-red-300 bg-red-50" : "border-green-200 bg-green-50"}`}>
                      <div className="flex justify-between text-xs text-gray-600"><span>Subtotal bruto:</span><span className="font-mono">{Q(totalBruto)}</span></div>
                      {!exentoIva && <div className="flex justify-between text-xs text-gray-500"><span>Descuento IVA (12%):</span><span className="font-mono">- {Q(totalBruto * 0.12)}</span></div>}
                      <div className={`flex justify-between text-sm font-bold border-t pt-1.5 ${totalExcede ? "border-red-300 text-red-700" : "border-green-300 text-green-700"}`}>
                        <span>Total</span><span className="font-mono">{Q(totalFinal)}</span>
                      </div>
                      {totalExcede
                        ? <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Supera el límite de {Q(limite)}</p>
                        : <p className="text-xs text-green-600">✓ Dentro del límite de {Q(limite)}</p>}
                    </div>
                  )}
                  {/* Regularizado/Normal — solo si no es Compra Directa */}
                  {tipoCompraActual && tipoCompraActual !== "Compra Directa" && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Tipo de gasto</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[{ val: true, label: "Regularizado", color: "purple" }, { val: false, label: "Normal", color: "indigo" }].map(opt => (
                          <button key={String(opt.val)} onClick={() => setRegularizado(opt.val)}
                            className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${regularizado === opt.val ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 bg-white text-gray-700 hover:border-brand-300"}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {regularizado === true ? "→ Pasará a Fondo Rotativo (SIAF-04)" : regularizado === false ? "→ Pasará a Presupuesto (General)" : "Elige para continuar"}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Errores */}
              {error && !limitExceeded && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
              )}

              {/* Límite excedido */}
              {limitExceeded && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div><p className="font-semibold">Total supera el límite</p><p className="mt-0.5">{error}</p>
                      <p className="mt-1 text-xs text-red-600">Si anulas, los SIAFs regresan a "Borrador".</p></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setLimitExceeded(false); setError(""); }} className="flex-1 btn-secondary justify-center">Corregir precios</button>
                    <button onClick={handleAnular} disabled={loading}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />} Anular Consolidación
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!limitExceeded && (
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
                {ctx.mode === "adjudicar" && step > 0
                  ? <button onClick={() => { setStep(s => s - 1); setError(""); }} className="btn-secondary">← Atrás</button>
                  : <button onClick={closeModal} className="btn-secondary">Cancelar</button>}

                {/* Junta paso 0 → 1 */}
                {ctx.mode === "adjudicar" && step === 0 && (
                  <button onClick={() => { if (!tipoCompra) return setError("Selecciona un tipo"); setError(""); setStep(1); }}
                    disabled={!tipoCompra} className="btn-primary disabled:opacity-50">Continuar →</button>
                )}
                {/* Junta paso 1 → confirmar */}
                {ctx.mode === "adjudicar" && step === 1 && (
                  <button onClick={handleAdjudicar} disabled={loading || !provSelected || !numAdj}
                    className="btn-primary disabled:opacity-50">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><Gavel className="w-4 h-4" /> Adjudicar</>}
                  </button>
                )}
                {/* Compras completar */}
                {ctx.mode === "completar" && (
                  <button onClick={handleCompletar}
                    disabled={loading || totalFinal <= 0 || totalExcede || (tipoCompraActual !== "Compra Directa" && regularizado === null)}
                    className="btn-primary disabled:opacity-50">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><Layers className="w-4 h-4" /> Confirmar</>}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
