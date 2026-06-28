"use client";
import { Fragment, useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Gavel, ChevronDown, ChevronRight, Search, FileText,
  X, Loader2, AlertTriangle, ShoppingCart, CheckCircle2,
  Building2, Hash, Calendar, DollarSign,
} from "lucide-react";
import {
  adjudicarFase1, generarOrdenCompra, completarOrdenDirecta,
  anularConsolidacion, buscarProveedoresAuto,
} from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type SiafResumen = {
  id: number; numero: number; anio: number; fecha: string; estado: string;
  consolidacion_id: number | null;
};
type Consolidacion = {
  id: number; numero: number; anio: number; fecha: string;
  tipo_compra: string | null; estado: string;
  nog: string | null; fecha_evento: string | null;
  referencia: string | null; costo_unitario: number | null;
  exento_iva: boolean; total: number | null;
  proveedor_nit: string | null; proveedor_nombre: string | null;
  creado_por: number | null; created_at: string | null;
  siaf: SiafResumen[];
  total_cantidad: number;
};
type Proveedor = { id: number; nit: string | null; nombre: string; telefono: string | null };

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPOS = ["Compra Directa", "Baja Cuantía", "Contrato Abierto", "Casos de Excepción"] as const;
type TipoCompra = typeof TIPOS[number];

const REFERENCIA_LABEL: Record<string, string> = {
  "Baja Cuantía":      "No. de Cotización",
  "Contrato Abierto":  "No. de Contrato",
  "Casos de Excepción": "Tipo de Servicio",
};

const TIPO_COLOR: Record<string, string> = {
  "Compra Directa":     "bg-blue-100 text-blue-700",
  "Baja Cuantía":       "bg-emerald-100 text-emerald-700",
  "Contrato Abierto":   "bg-amber-100 text-amber-700",
  "Casos de Excepción": "bg-orange-100 text-orange-700",
};

const ESTADO_COLOR: Record<string, string> = {
  "Pendiente adjudicación": "bg-amber-100 text-amber-700",
  "Adjudicado":             "bg-blue-100 text-blue-700",
  "Orden de Compra Generada": "bg-green-100 text-green-700",
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Modal state ──────────────────────────────────────────────────────────────

type ModalCtx = { consolidacion: Consolidacion; mode: "adjudicar" | "completar" } | null;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdjudicacionClient({ consolidaciones: init }: { consolidaciones: Consolidacion[] }) {
  const router = useRouter();
  const [consolidaciones, setConsolidaciones] = useState(init);
  const [query,      setQuery]      = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Modal
  const [ctx,           setCtx]           = useState<ModalCtx>(null);
  const [step,          setStep]          = useState(0);        // 0=tipo, 1=form, 2=proveedor
  const [tipoCompra,    setTipoCompra]    = useState<TipoCompra | "">("");
  const [nog,           setNog]           = useState("");
  const [fechaEvento,   setFechaEvento]   = useState(new Date().toISOString().slice(0, 10));
  const [referencia,    setReferencia]    = useState("");
  const [costoStr,      setCostoStr]      = useState("");
  const [exentoIva,     setExentoIva]     = useState(true);
  const [provQ,         setProvQ]         = useState("");
  const [provSugg,      setProvSugg]      = useState<Proveedor[]>([]);
  const [provSearching, setProvSearching] = useState(false);
  const [provSelected,  setProvSelected]  = useState<Proveedor | null>(null);
  const [showProvDrop,  setShowProvDrop]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [limitError,    setLimitError]    = useState(false); // special error for limit exceeded

  const provTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Computed totals
  const costo        = parseFloat(costoStr) || 0;
  const totalCant    = ctx?.consolidacion.total_cantidad ?? 0;
  const bruto        = costo * totalCant;
  const totalCalc    = exentoIva ? bruto : bruto * 0.88;
  const limite       = (tipoCompra === "Compra Directa" || ctx?.mode === "completar") ? 90000 : 25000;
  const totalExcede  = totalCalc > 0 && totalCalc > limite;
  const totalOK      = totalCalc > 0 && !totalExcede;

  // Filtered table
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return consolidaciones;
    return consolidaciones.filter(c =>
      `${c.numero}/${c.anio}`.includes(q) ||
      c.fecha.includes(q) ||
      (c.tipo_compra ?? "").toLowerCase().includes(q) ||
      c.siaf.some(s => `${s.numero}/${s.anio}`.includes(q))
    );
  }, [consolidaciones, query]);

  // ─── Modal helpers ──────────────────────────────────────────────────────────

  function resetModal() {
    setStep(0); setTipoCompra(""); setNog(""); setFechaEvento(new Date().toISOString().slice(0, 10));
    setReferencia(""); setCostoStr(""); setExentoIva(true);
    setProvQ(""); setProvSugg([]); setProvSelected(null); setShowProvDrop(false);
    setError(""); setLimitError(false); setLoading(false);
  }

  function openAdjudicar(c: Consolidacion) {
    resetModal();
    setCtx({ consolidacion: c, mode: "adjudicar" });
  }

  function openCompletar(c: Consolidacion) {
    resetModal();
    setTipoCompra("Compra Directa");
    setStep(1);
    setCtx({ consolidacion: c, mode: "completar" });
  }

  function closeModal() { setCtx(null); resetModal(); }

  // ─── Proveedor search ───────────────────────────────────────────────────────

  useEffect(() => {
    if (provTimer.current) clearTimeout(provTimer.current);
    if (provQ.trim().length < 2) { setProvSugg([]); return; }
    provTimer.current = setTimeout(async () => {
      setProvSearching(true);
      const res = await buscarProveedoresAuto(provQ);
      setProvSugg(res);
      setProvSearching(false);
      setShowProvDrop(true);
    }, 300);
  }, [provQ]);

  // ─── Step navigation ────────────────────────────────────────────────────────

  async function handleNextFromTipo() {
    if (!tipoCompra) return setError("Selecciona un tipo de compra");
    setError("");
    setStep(1);
  }

  async function handleFase1Directa() {
    if (!nog.trim()) return setError("El NOG es obligatorio");
    if (!fechaEvento) return setError("La fecha de finalización es obligatoria");
    setLoading(true); setError("");
    const res = await adjudicarFase1(ctx!.consolidacion.id, nog.trim(), fechaEvento);
    setLoading(false);
    if (res.error) return setError(res.error);
    setConsolidaciones(p => p.map(c =>
      c.id === ctx!.consolidacion.id
        ? { ...c, estado: "Adjudicado", tipo_compra: "Compra Directa", nog: nog.trim(), fecha_evento: fechaEvento }
        : c
    ));
    closeModal();
  }

  function handleNextFromForm() {
    const refLabel = tipoCompra ? (REFERENCIA_LABEL[tipoCompra] ?? "") : "";
    if (tipoCompra !== "Compra Directa" && !referencia.trim())
      return setError(`El campo "${refLabel}" es obligatorio`);
    if (!costoStr || costo <= 0) return setError("Ingresa un costo unitario válido");
    if (totalExcede) return setError(`El total supera el límite de ${Q(limite)}. Ajusta el costo o anula la consolidación.`);
    setError(""); setStep(2);
  }

  async function handleGenerarOrden() {
    if (!provSelected) return setError("Selecciona un proveedor");
    setLoading(true); setError("");

    const provData = {
      proveedor_id:    provSelected.id,
      proveedor_nit:   provSelected.nit ?? "",
      proveedor_nombre: provSelected.nombre,
      costo_unitario:  costo,
      exento_iva:      exentoIva,
      total:           totalCalc,
      total_cantidad:  totalCant,
    };

    let res: { orden?: any; error?: string };

    if (ctx!.mode === "completar") {
      res = await completarOrdenDirecta(ctx!.consolidacion.id, provData);
    } else {
      res = await generarOrdenCompra(ctx!.consolidacion.id, {
        tipo_compra:  tipoCompra as "Baja Cuantía" | "Contrato Abierto" | "Casos de Excepción",
        referencia:   referencia.trim(),
        ...provData,
      });
    }

    setLoading(false);
    if (res.error) return setError(res.error);

    setConsolidaciones(p => p.map(c =>
      c.id === ctx!.consolidacion.id
        ? {
            ...c,
            estado:           "Orden de Compra Generada",
            tipo_compra:      tipoCompra || "Compra Directa",
            proveedor_nit:    provSelected!.nit,
            proveedor_nombre: provSelected!.nombre,
            total:            totalCalc,
          }
        : c
    ));
    closeModal();
    router.refresh();
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

  // ─── Render ─────────────────────────────────────────────────────────────────

  const modalTitle = ctx?.mode === "completar" ? "Completar Orden — Compra Directa" : "Adjudicar Consolidación";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Gavel className="w-5 h-5" /> Adjudicaciones
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{consolidaciones.length} consolidación(es) registrada(s)</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por correlativo, tipo o SIAF…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Correlativo</th>
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
                    <tr
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(p => p === c.id ? null : c.id)}>
                      <td className="px-4 py-3 text-gray-400">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                        ADJ-{String(c.numero).padStart(3, "0")}/{c.anio}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {c.tipo_compra ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLOR[c.tipo_compra] ?? "bg-gray-100 text-gray-600"}`}>
                            {c.tipo_compra}
                          </span>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.fecha}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                          {c.siaf.length}
                        </span>
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
                        {c.estado === "Pendiente adjudicación" && (
                          <button onClick={() => openAdjudicar(c)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                            <Gavel className="w-3 h-3" /> Adjudicar
                          </button>
                        )}
                        {c.estado === "Adjudicado" && c.tipo_compra === "Compra Directa" && (
                          <button onClick={() => openCompletar(c)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                            <ShoppingCart className="w-3 h-3" /> Completar orden
                          </button>
                        )}
                        {c.estado === "Orden de Compra Generada" && (
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
                                <FileText className="w-3.5 h-3.5" />
                                SIAFs consolidados
                              </p>
                              <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Correlativo</th>
                                      <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Fecha</th>
                                      <th className="px-3 py-1.5 text-center font-semibold text-gray-600">Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 bg-white">
                                    {c.siaf.map(s => (
                                      <tr key={s.id}>
                                        <td className="px-3 py-2 font-mono font-bold text-gray-900">{s.numero}/{s.anio}</td>
                                        <td className="px-3 py-2 text-gray-600">{s.fecha}</td>
                                        <td className="px-3 py-2 text-center">
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                            s.estado === "Orden de Compra" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"
                                          }`}>{s.estado}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            {/* Detalles de la consolidación */}
                            <div className="space-y-2 text-xs text-gray-600">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Detalles</p>
                              {c.nog && <p><span className="font-semibold">NOG:</span> {c.nog}</p>}
                              {c.fecha_evento && <p><span className="font-semibold">Fecha evento:</span> {c.fecha_evento}</p>}
                              {c.referencia && <p><span className="font-semibold">Referencia:</span> {c.referencia}</p>}
                              {c.costo_unitario != null && <p><span className="font-semibold">Costo unitario:</span> {Q(c.costo_unitario)}</p>}
                              {c.total != null && (
                                <p><span className="font-semibold">Total:</span> <span className="text-green-700 font-bold">{Q(c.total)}</span>
                                  {c.exento_iva ? <span className="ml-1 text-gray-400">(exento IVA)</span> : <span className="ml-1 text-gray-400">(inc. 12% IVA descontado)</span>}
                                </p>
                              )}
                              {c.proveedor_nombre && (
                                <p><span className="font-semibold">Proveedor:</span> {c.proveedor_nombre} {c.proveedor_nit && `· NIT: ${c.proveedor_nit}`}</p>
                              )}
                              <p><span className="font-semibold">Total cantidad consolidada:</span> {c.total_cantidad.toLocaleString("es-GT")}</p>
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
              <p className="text-sm">No hay consolidaciones aún. Ve a A-01 SIAF, selecciona solicitudes aprobadas y consolídalas.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de adjudicación ── */}
      {ctx && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Gavel className="w-4 h-4 text-amber-600" />{modalTitle}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  ADJ-{String(ctx.consolidacion.numero).padStart(3, "0")}/{ctx.consolidacion.anio}
                  {" · "}{ctx.consolidacion.siaf.length} SIAF(s) · {ctx.consolidacion.total_cantidad.toLocaleString("es-GT")} unidades totales
                </p>
              </div>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            <div className="px-5 py-5 space-y-5">

              {/* ── STEP 0: Seleccionar tipo ── */}
              {step === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Selecciona el tipo de compra:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {TIPOS.map(t => (
                      <button key={t} onClick={() => setTipoCompra(t)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all
                          ${tipoCompra === t
                            ? "border-brand-600 bg-brand-50 text-brand-700"
                            : "border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-gray-50"
                          }`}>
                        <Gavel className="w-5 h-5" />
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── STEP 1: Compra Directa Fase 1 ── */}
              {step === 1 && tipoCompra === "Compra Directa" && ctx.mode === "adjudicar" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <Hash className="w-3.5 h-3.5 shrink-0" />
                    Fase 1: Ingresa el NOG del evento de Guatecompras
                  </div>
                  <div>
                    <label className="label">NOG <span className="text-red-500">*</span></label>
                    <input className="input font-mono" value={nog} onChange={e => setNog(e.target.value)}
                      placeholder="Ej: 12345678" autoFocus />
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Fecha de finalización del evento <span className="text-red-500">*</span>
                    </label>
                    <input className="input" type="date" value={fechaEvento} onChange={e => setFechaEvento(e.target.value)} />
                  </div>
                </div>
              )}

              {/* ── STEP 1: Otros tipos (form de costo) ── */}
              {step === 1 && tipoCompra !== "Compra Directa" && (
                <div className="space-y-4">
                  {/* Referencia */}
                  <div>
                    <label className="label">{REFERENCIA_LABEL[tipoCompra] ?? "Referencia"} <span className="text-red-500">*</span></label>
                    <input className="input" value={referencia} onChange={e => setReferencia(e.target.value)}
                      placeholder={`Ej: ${tipoCompra === "Baja Cuantía" ? "COT-001/2026" : tipoCompra === "Contrato Abierto" ? "CT-001/2026" : "Descripción del servicio"}`}
                      autoFocus />
                  </div>
                  <FormCosto costoStr={costoStr} setCostoStr={setCostoStr} exentoIva={exentoIva} setExentoIva={setExentoIva}
                    bruto={bruto} totalCalc={totalCalc} totalCant={totalCant} limite={limite} totalExcede={totalExcede} />
                </div>
              )}

              {/* ── STEP 1: Completar Orden Compra Directa (solo costo) ── */}
              {step === 1 && ctx.mode === "completar" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    Fase 2 — Completar Orden · NOG: <span className="font-mono font-bold">{ctx.consolidacion.nog}</span>
                  </div>
                  <FormCosto costoStr={costoStr} setCostoStr={setCostoStr} exentoIva={exentoIva} setExentoIva={setExentoIva}
                    bruto={bruto} totalCalc={totalCalc} totalCant={totalCant} limite={limite} totalExcede={totalExcede} />
                </div>
              )}

              {/* ── STEP 2: Proveedor ── */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* Resumen del total */}
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
                    <p className="text-sm text-green-800 font-medium">Total de la orden</p>
                    <p className="text-xl font-bold text-green-700 font-mono">{Q(totalCalc)}</p>
                  </div>

                  <div className="relative">
                    <label className="label flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> NIT o Proveedor <span className="text-red-500">*</span>
                    </label>
                    {provSelected ? (
                      <div className="flex items-center justify-between p-3 border border-green-300 bg-green-50 rounded-xl">
                        <div>
                          <p className="text-sm font-semibold text-green-900">{provSelected.nombre}</p>
                          <p className="text-xs text-green-700">NIT: {provSelected.nit ?? "—"} {provSelected.telefono ? `· ${provSelected.telefono}` : ""}</p>
                        </div>
                        <button onClick={() => { setProvSelected(null); setProvQ(""); }}
                          className="p-1 text-green-600 hover:text-red-600 rounded-lg"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input className="input pl-9" value={provQ}
                          onChange={e => { setProvQ(e.target.value); setShowProvDrop(true); }}
                          onFocus={() => provSugg.length > 0 && setShowProvDrop(true)}
                          onBlur={() => setTimeout(() => setShowProvDrop(false), 200)}
                          placeholder="Escribe NIT o nombre del proveedor…" autoFocus />
                        {provSearching && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                        )}
                        {showProvDrop && provSugg.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                            {provSugg.map(p => (
                              <button key={p.id} type="button"
                                onMouseDown={() => { setProvSelected(p); setProvQ(p.nombre); setShowProvDrop(false); }}
                                className="w-full text-left px-4 py-2.5 hover:bg-brand-50 border-b border-gray-50 last:border-0">
                                <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                                <p className="text-xs text-gray-400">NIT: {p.nit ?? "—"} {p.telefono ? `· ${p.telefono}` : ""}</p>
                              </button>
                            ))}
                          </div>
                        )}
                        {showProvDrop && provQ.length >= 2 && !provSearching && provSugg.length === 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 text-sm text-gray-400">
                            No se encontró el proveedor. Agrégalo en Base de Datos → Proveedores.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Error general ── */}
              {error && !limitError && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
              )}

              {/* ── Error de límite ── */}
              {limitError && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Total supera el límite</p>
                      <p className="mt-0.5">{error}</p>
                      {ctx.mode !== "completar" && (
                        <p className="mt-1 text-xs text-red-600">Si anulas la consolidación, los SIAFs regresan al estado anterior para que puedas modificarlos.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setLimitError(false); setError(""); }}
                      className="flex-1 btn-secondary justify-center">
                      {ctx.mode === "completar" ? "Corregir precio" : "Cancelar"}
                    </button>
                    <button onClick={handleAnular} disabled={loading}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                      Anular Consolidación
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            {!limitError && (
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
                <button onClick={step > 0 ? () => { setStep(s => s - 1); setError(""); } : closeModal}
                  className="btn-secondary">
                  {step > 0 ? "← Atrás" : "Cancelar"}
                </button>

                {/* Step 0: Continuar */}
                {step === 0 && (
                  <button onClick={handleNextFromTipo} disabled={!tipoCompra}
                    className="btn-primary disabled:opacity-50">
                    Continuar →
                  </button>
                )}

                {/* Step 1: Compra Directa Fase 1 → Adjudicar */}
                {step === 1 && tipoCompra === "Compra Directa" && ctx.mode === "adjudicar" && (
                  <button onClick={handleFase1Directa} disabled={loading}
                    className="btn-primary disabled:opacity-50">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><Gavel className="w-4 h-4" /> Adjudicar</>}
                  </button>
                )}

                {/* Step 1: Otros tipos o CD Completar → Siguiente (con validación de límite) */}
                {step === 1 && (tipoCompra !== "Compra Directa" || ctx.mode === "completar") && (
                  <button
                    onClick={() => {
                      if (totalExcede) {
                        setError(`El total ${Q(totalCalc)} supera el límite de ${Q(limite)} para ${tipoCompra || "Compra Directa"}.`);
                        setLimitError(true);
                      } else {
                        handleNextFromForm();
                      }
                    }}
                    disabled={!totalOK && !totalExcede}
                    className="btn-primary disabled:opacity-50">
                    Siguiente →
                  </button>
                )}

                {/* Step 2: Generar Orden */}
                {step === 2 && (
                  <button onClick={handleGenerarOrden} disabled={loading || !provSelected}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</>
                      : <><ShoppingCart className="w-4 h-4" /> Generar Orden de Compra</>}
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

// ─── Sub-componente: formulario de costo + IVA ────────────────────────────────

function FormCosto({ costoStr, setCostoStr, exentoIva, setExentoIva, bruto, totalCalc, totalCant, limite, totalExcede }: {
  costoStr: string; setCostoStr: (v: string) => void;
  exentoIva: boolean; setExentoIva: (v: boolean) => void;
  bruto: number; totalCalc: number; totalCant: number; limite: number; totalExcede: boolean;
}) {
  const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div className="space-y-4">
      <div>
        <label className="label flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5" /> Costo unitario <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Q</span>
          <input className="input pl-7 font-mono" type="number" step="0.01" min="0.01"
            value={costoStr} onChange={e => setCostoStr(e.target.value)}
            placeholder="0.00" autoFocus />
        </div>
        <p className="text-xs text-gray-400 mt-1">Se multiplicará por {totalCant.toLocaleString("es-GT")} unidades totales</p>
      </div>

      {/* Checkbox exento IVA */}
      <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
        <input type="checkbox" checked={exentoIva} onChange={e => setExentoIva(e.target.checked)}
          className="w-4 h-4 accent-brand-600" />
        <div>
          <p className="text-sm font-medium text-gray-800">Exento de IVA</p>
          <p className="text-xs text-gray-400">
            {exentoIva ? "Precio sin descuento de IVA" : "Se descuenta el 12% del total"}
          </p>
        </div>
      </label>

      {/* Total calculado */}
      {costoStr && parseFloat(costoStr) > 0 && (
        <div className={`rounded-xl border px-4 py-3 space-y-1.5 ${totalExcede ? "border-red-300 bg-red-50" : "border-green-200 bg-green-50"}`}>
          <div className="flex justify-between text-xs text-gray-600">
            <span>Subtotal bruto:</span>
            <span className="font-mono">{Q(bruto)}</span>
          </div>
          {!exentoIva && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>Descuento IVA (12%):</span>
              <span className="font-mono">- {Q(bruto * 0.12)}</span>
            </div>
          )}
          <div className={`flex justify-between text-sm font-bold border-t pt-1.5 mt-1 ${totalExcede ? "border-red-300 text-red-700" : "border-green-300 text-green-700"}`}>
            <span>Total</span>
            <span className="font-mono">{Q(totalCalc)}</span>
          </div>
          {totalExcede && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Supera el límite de {Q(limite)}
            </p>
          )}
          {!totalExcede && (
            <p className="text-xs text-green-600">✓ Dentro del límite de {Q(limite)}</p>
          )}
        </div>
      )}
    </div>
  );
}
