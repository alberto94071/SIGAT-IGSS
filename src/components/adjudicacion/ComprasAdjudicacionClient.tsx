"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Gavel, X, Loader2, AlertTriangle, CheckCircle2, Hash, Calendar,
  ShoppingCart, Building2, DollarSign, Layers, XCircle, FileText, Printer,
} from "lucide-react";
import ConsolidacionesTable, { Q, correlativo } from "./ConsolidacionesTable";
import OferentesEditor from "./OferentesEditor";
import NitAutocomplete from "./NitAutocomplete";
import {
  elegirTipoCompra, guardarCompraDirectaEvento, agregarOferente, eliminarOferente,
  elegirFormaBajaCuantia, buscarCotizacionServicio, confirmarBajaCuantiaServicios,
  adjudicarDirecto, enviarAJunta, registrarRegularizado,
} from "@/lib/adjudicacion/compras-actions";
import { completarAdjudicacion, anularConsolidacion } from "@/lib/adjudicacion/actions";
import {
  TIPOS, REFERENCIA_LABEL, MAX_OFERENTES, LIMITE_POR_TIPO,
  type TipoCompra, type Consolidacion, type CotizacionServicio, type Oferente,
} from "@/lib/adjudicacion/types";

interface Props { consolidaciones: Consolidacion[]; canEdit: boolean; }

type SubTipoBaja = "con_insumos" | "por_servicios" | null;

export default function ComprasAdjudicacionClient({ consolidaciones: init, canEdit }: Props) {
  const [consolidaciones, setConsolidaciones] = useState(init);
  const [wizardFor,   setWizardFor]   = useState<Consolidacion | null>(null);
  const [motivoFor,   setMotivoFor]   = useState<Consolidacion | null>(null);
  const [completando, setCompletando] = useState<number | null>(null);
  const [rowError,    setRowError]    = useState<Record<number, string>>({});

  function updateConsolidacion(id: number, patch: Partial<Consolidacion>) {
    setConsolidaciones(p => p.map(c => c.id === id ? { ...c, ...patch } : c));
  }

  async function handleCompletar(c: Consolidacion) {
    setCompletando(c.id);
    setRowError(prev => ({ ...prev, [c.id]: "" }));
    const res = await completarAdjudicacion(c.id);
    setCompletando(null);
    if ("error" in res) { setRowError(prev => ({ ...prev, [c.id]: res.error })); return; }
    updateConsolidacion(c.id, { estado: "Enviado a Presupuesto", destino: "presupuesto" });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Gavel className="w-5 h-5" /> Adjudicaciones
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{consolidaciones.length} consolidación(es)</p>
        </div>
        <Link href="/compras/adjudicacion/acta-negociacion" className="btn-secondary">
          <FileText className="w-4 h-4" /> Acta de Negociación
        </Link>
      </div>

      <ConsolidacionesTable
        consolidaciones={consolidaciones}
        onVerMotivo={setMotivoFor}
        acciones={c => (
          <div className="flex flex-col items-end gap-1">
            {canEdit && (c.estado === "Pendiente adjudicación" || c.estado === "Rechazado por Junta") && (
              <button onClick={() => setWizardFor(c)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                <Gavel className="w-3 h-3" /> {c.estado === "Rechazado por Junta" ? "Corregir y reenviar" : "Iniciar adjudicación"}
              </button>
            )}
            {c.numero_cheque && (
              <Link href={`/compras/adjudicacion/${c.id}/conformidad`} target="_blank"
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                <Printer className="w-3 h-3" /> Carta de Conformidad
              </Link>
            )}
            {canEdit && c.estado === "Adjudicado" && c.acta_aprobada && (
              <button onClick={() => handleCompletar(c)} disabled={completando === c.id}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {completando === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingCart className="w-3 h-3" />}
                Completar Adjudicación
              </button>
            )}
            {c.estado === "Adjudicado" && !c.acta_aprobada && (
              <span className="text-[11px] text-amber-600 max-w-[160px] text-right">Esperando aprobación del Acta</span>
            )}
            {["Enviado a Junta", "Enviado a Fondo Rotativo", "Enviado a Presupuesto", "Orden de Compra Generada"].includes(c.estado) && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <CheckCircle2 className="w-3.5 h-3.5" /> En proceso
              </span>
            )}
            {rowError[c.id] && <p className="text-[10px] text-red-600 max-w-[160px] text-right">{rowError[c.id]}</p>}
          </div>
        )}
      />

      {wizardFor && (
        <WizardModal
          consolidacion={wizardFor}
          onClose={() => setWizardFor(null)}
          onDone={result => {
            if ("removed" in result) setConsolidaciones(p => p.filter(c => c.id !== wizardFor.id));
            else updateConsolidacion(wizardFor.id, result);
            setWizardFor(null);
          }}
        />
      )}

      {motivoFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" /> {correlativo(motivoFor)} — Rechazado por Junta
              </h2>
              <button onClick={() => setMotivoFor(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Motivo</p>
                <p className="text-gray-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
                  {motivoFor.motivo_rechazo || "—"}
                </p>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Rechazado por: <strong className="text-gray-700">{motivoFor.rechazado_por_nombre ?? "—"}</strong></span>
                <span>{motivoFor.rechazado_en ?? ""}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setMotivoFor(null)} className="btn-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Wizard modal ─────────────────────────────────────────────────────────────

function WizardModal({ consolidacion: c, onClose, onDone }: {
  consolidacion: Consolidacion; onClose: () => void;
  onDone: (result: Partial<Consolidacion> | { removed: true }) => void;
}) {
  const [tipoCompra, setTipoCompra] = useState<TipoCompra | "">((c.tipo_compra as TipoCompra) ?? "");
  const [subTipo,    setSubTipo]    = useState<SubTipoBaja>(null);
  const [regularizado, setRegularizadoState] = useState<boolean | null>(c.regularizado);
  const [oferentes,  setOferentes]  = useState<Oferente[]>(c.oferentes);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [limitExceeded, setLimitExceeded] = useState(false);

  const [nog,         setNog]         = useState(c.nog ?? "");
  const [fechaEvento, setFechaEvento] = useState(c.fecha_evento ?? new Date().toISOString().slice(0, 10));
  const [referencia,  setReferencia]  = useState(c.referencia ?? "");

  const [cotizaciones,   setCotizaciones]   = useState<CotizacionServicio[]>([]);
  const [cotizLoading,   setCotizLoading]   = useState(false);
  const [cotizId,        setCotizId]        = useState<number | null>(null);

  const [duNit, setDuNit] = useState(""); const [duNombre, setDuNombre] = useState("");
  const [duCosto, setDuCosto] = useState(""); const [duExento, setDuExento] = useState(false);
  const [duProveedorId, setDuProveedorId] = useState<number | null>(null);
  const [duRazon, setDuRazon] = useState(c.numero_adjudicacion ?? "");

  const [rgNit, setRgNit] = useState(""); const [rgNombre, setRgNombre] = useState("");
  const [rgMonto, setRgMonto] = useState(""); const [rgExento, setRgExento] = useState(false);
  const [rgCheque, setRgCheque] = useState("");

  async function pickTipo(t: TipoCompra) {
    setLoading(true); setError("");
    const res = await elegirTipoCompra(c.id, t);
    setLoading(false);
    if ("error" in res) return setError(res.error);
    setTipoCompra(t);
    if (t !== "Baja Cuantía") setOferentes([]);
  }

  async function guardarEvento() {
    if (!nog.trim() || !fechaEvento) return setError("NOG y fecha del evento son obligatorios");
    setLoading(true); setError("");
    const res = await guardarCompraDirectaEvento(c.id, { nog: nog.trim(), fecha_evento: fechaEvento });
    setLoading(false);
    if ("error" in res) return setError(res.error);
  }

  async function handleAddOferente(data: { proveedor_id: number | null; nit: string; nombre: string; costo: number; exento_iva: boolean }) {
    const res = await agregarOferente(c.id, data);
    if ("error" in res) { setError(res.error!); return; }
    if (res.oferente) setOferentes(p => [...p, res.oferente as unknown as Oferente]);
  }

  async function handleRemoveOferente(id: number) {
    await eliminarOferente(id);
    setOferentes(p => p.filter(o => o.id !== id));
  }

  async function pickFormaBaja(reg: boolean) {
    setLoading(true); setError("");
    const res = await elegirFormaBajaCuantia(c.id, reg);
    setLoading(false);
    if ("error" in res) return setError(res.error);
    setRegularizadoState(reg);
    if (!reg && "subTipo" in res) {
      setSubTipo(res.subTipo);
      if (res.subTipo === "por_servicios") {
        setCotizLoading(true);
        const cs = await buscarCotizacionServicio();
        setCotizLoading(false);
        setCotizaciones(cs as unknown as CotizacionServicio[]);
      }
    }
  }

  async function finalizarEnviar() {
    if (oferentes.length === 0) return setError("Agrega al menos un oferente");
    if (tipoCompra === "Baja Cuantía" && !referencia.trim()) return setError(`El campo "${REFERENCIA_LABEL["Baja Cuantía"]}" es obligatorio`);
    setLoading(true); setError("");
    const res = await enviarAJunta(c.id, { referencia: referencia.trim() || undefined });
    setLoading(false);
    if ("error" in res) return setError(res.error);
    onDone({ estado: "Enviado a Junta", tipo_compra: tipoCompra, oferentes, referencia: referencia.trim() || c.referencia });
  }

  async function confirmarServicio() {
    if (!cotizId) return setError("Selecciona una cotización");
    if (!referencia.trim()) return setError(`El campo "${REFERENCIA_LABEL["Baja Cuantía"]}" es obligatorio`);
    setLoading(true); setError("");
    const res = await confirmarBajaCuantiaServicios(c.id, cotizId, referencia.trim());
    setLoading(false);
    if ("error" in res) return setError(res.error);
    onDone({ estado: "Enviado a Junta", tipo_compra: tipoCompra, referencia: referencia.trim() });
  }

  async function handleAdjudicarDirecto() {
    const costoNum = parseFloat(duCosto);
    if (!duNit.trim() || !duNombre.trim()) return setError("NIT y nombre son obligatorios");
    if (!(costoNum > 0)) return setError("Ingresa un costo de factura válido");
    if (!duRazon.trim()) return setError("La razón de adjudicación es obligatoria");
    setLoading(true); setError(""); setLimitExceeded(false);
    const res = await adjudicarDirecto(c.id, {
      proveedor_id: duProveedorId, nit: duNit.trim(), nombre: duNombre.trim(),
      costo: costoNum, exento_iva: duExento, referencia, razon: duRazon.trim(),
    });
    setLoading(false);
    if ("limitExceeded" in res) { setLimitExceeded(true); setError(res.error); return; }
    if ("error" in res) return setError(res.error);
    const esFondoRotativo = tipoCompra === "Casos de Excepción";
    onDone({
      estado: esFondoRotativo ? "Enviado a Fondo Rotativo" : "Enviado a Presupuesto",
      destino: esFondoRotativo ? "fondo_rotativo" : "presupuesto",
      tipo_compra: tipoCompra, referencia, numero_adjudicacion: duRazon.trim(),
      proveedor_nit: duNit.trim(), proveedor_nombre: duNombre.trim(),
      exento_iva: duExento, total: duExento ? costoNum : costoNum * 0.88,
    });
  }

  async function enviarRegularizado() {
    const montoNum = parseFloat(rgMonto);
    if (!rgNit.trim() || !rgNombre.trim()) return setError("NIT y nombre son obligatorios");
    if (!(montoNum > 0)) return setError("Ingresa un monto válido");
    if (!rgCheque.trim()) return setError("El número de cheque es obligatorio");
    setLoading(true); setError(""); setLimitExceeded(false);
    const res = await registrarRegularizado(c.id, {
      nit: rgNit.trim(), nombre: rgNombre.trim(), monto: montoNum, exento_iva: rgExento, numero_cheque: rgCheque.trim(),
    });
    setLoading(false);
    if ("limitExceeded" in res) { setLimitExceeded(true); setError(res.error); return; }
    if ("error" in res) return setError(res.error);
    onDone({ estado: "Enviado a Fondo Rotativo", destino: "fondo_rotativo", tipo_compra: tipoCompra });
  }

  async function handleAnular() {
    setLoading(true); setError("");
    const res = await anularConsolidacion(c.id);
    setLoading(false);
    if ("error" in res) return setError(res.error);
    onDone({ removed: true });
  }

  const referenciaLabel = tipoCompra && tipoCompra !== "Compra Directa" ? REFERENCIA_LABEL[tipoCompra] : null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Gavel className="w-4 h-4 text-amber-600" /> Iniciar Adjudicación
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{correlativo(c)} · {c.siaf.length} SIAF(s)</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Paso: tipo de compra */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Tipo de compra</p>
            <div className="grid grid-cols-2 gap-3">
              {TIPOS.map(t => (
                <button key={t} onClick={() => pickTipo(t)} disabled={loading}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${tipoCompra === t ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 bg-white text-gray-700 hover:border-brand-300"}`}>
                  <Gavel className="w-4 h-4" />{t}
                </button>
              ))}
            </div>
          </div>

          {/* Compra Directa: NOG + evento + oferentes */}
          {tipoCompra === "Compra Directa" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> NOG</label>
                  <input className="input font-mono" value={nog} onChange={e => setNog(e.target.value)} onBlur={guardarEvento} />
                </div>
                <div>
                  <label className="label flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Fecha del evento</label>
                  <input className="input" type="date" value={fechaEvento} onChange={e => setFechaEvento(e.target.value)} onBlur={guardarEvento} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Oferentes</p>
                <OferentesEditor oferentes={oferentes} maxOferentes={MAX_OFERENTES} editable
                  onAdd={handleAddOferente} onRemove={handleRemoveOferente} />
              </div>
            </div>
          )}

          {/* Baja Cuantía: elegir forma */}
          {tipoCompra === "Baja Cuantía" && regularizado === null && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">¿Regularizado o Normal?</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => pickFormaBaja(false)} disabled={loading}
                  className="p-3 rounded-xl border-2 border-gray-200 bg-white text-gray-700 hover:border-brand-300 text-sm font-medium">Normal</button>
                <button onClick={() => pickFormaBaja(true)} disabled={loading}
                  className="p-3 rounded-xl border-2 border-gray-200 bg-white text-gray-700 hover:border-brand-300 text-sm font-medium">Regularizado</button>
              </div>
            </div>
          )}

          {/* Baja Cuantía Normal — con insumos */}
          {tipoCompra === "Baja Cuantía" && regularizado === false && subTipo === "con_insumos" && (
            <div className="space-y-4">
              <div>
                <label className="label">{REFERENCIA_LABEL["Baja Cuantía"]}</label>
                <input className="input" value={referencia} onChange={e => setReferencia(e.target.value)} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Oferentes</p>
                <OferentesEditor oferentes={oferentes} maxOferentes={MAX_OFERENTES} editable
                  onAdd={handleAddOferente} onRemove={handleRemoveOferente} />
              </div>
            </div>
          )}

          {/* Baja Cuantía Normal — por servicios */}
          {tipoCompra === "Baja Cuantía" && regularizado === false && subTipo === "por_servicios" && (
            <div className="space-y-4">
              <div>
                <label className="label">{REFERENCIA_LABEL["Baja Cuantía"]}</label>
                <input className="input" value={referencia} onChange={e => setReferencia(e.target.value)} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Cotización de servicio recibida con antelación
                </p>
                {cotizLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                ) : cotizaciones.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    No hay cotizaciones de servicio registradas. Regístrala primero en Contrato y Cotizaciones.
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {cotizaciones.map(cot => (
                      <label key={cot.id}
                        className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 cursor-pointer ${cotizId === cot.id ? "bg-brand-50" : "bg-white"}`}>
                        <input type="radio" name="cotizacion" checked={cotizId === cot.id} onChange={() => setCotizId(cot.id)} className="w-4 h-4 accent-brand-600" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{cot.servicio}</p>
                          <p className="text-xs text-gray-400">{cot.proveedor_nombre} · {cot.fecha}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900 shrink-0">{Q(cot.costo)}</p>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Baja Cuantía Regularizado */}
          {tipoCompra === "Baja Cuantía" && regularizado === true && (
            <div className="space-y-3">
              <div>
                <label className="label flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> NIT</label>
                <NitAutocomplete
                  value={rgNit}
                  onChange={setRgNit}
                  onSelect={p => { setRgNit(p.nit ?? rgNit); setRgNombre(p.nombre); }}
                />
              </div>
              <div>
                <label className="label">Nombre del proveedor</label>
                <input className="input" value={rgNombre} onChange={e => setRgNombre(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <label className="label flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Monto</label>
                  <input type="number" step="0.01" min="0.01" className="input" value={rgMonto} onChange={e => setRgMonto(e.target.value)} />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap mt-6">
                  <input type="checkbox" checked={rgExento} onChange={e => setRgExento(e.target.checked)} className="w-3.5 h-3.5 accent-brand-600" />
                  Exento IVA
                </label>
              </div>
              <div>
                <label className="label">Número de cheque</label>
                <input className="input font-mono" value={rgCheque} onChange={e => setRgCheque(e.target.value)} />
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                Este caso no pasa por la Junta Adjudicadora — va directo a Fondo Rotativo. Recuerda imprimir el Acta
                de Negociación del año y la Carta de Conformidad una vez confirmado.
              </p>
            </div>
          )}

          {/* Contrato Abierto / Casos de Excepción: ya no pasan por Junta —
              Compras adjudica directo con una razón y el costo de factura */}
          {(tipoCompra === "Contrato Abierto" || tipoCompra === "Casos de Excepción") && (
            <div className="space-y-3">
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                Este tipo de compra no pasa por la Junta Adjudicadora — Compras adjudica directamente y la
                consolidación pasa de una vez a {tipoCompra === "Casos de Excepción" ? "Fondo Rotativo" : "Presupuesto"}.
              </p>
              {referenciaLabel && (
                <div>
                  <label className="label">{referenciaLabel}</label>
                  <input className="input" value={referencia} onChange={e => setReferencia(e.target.value)} />
                </div>
              )}
              <div>
                <label className="label flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> NIT</label>
                <NitAutocomplete
                  value={duNit}
                  onChange={v => { setDuNit(v); setDuProveedorId(null); }}
                  onSelect={p => { setDuNit(p.nit ?? duNit); setDuNombre(p.nombre); setDuProveedorId(p.id); }}
                />
              </div>
              <div>
                <label className="label">Nombre del proveedor</label>
                <input className="input" value={duNombre} onChange={e => setDuNombre(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <label className="label flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Costo de factura</label>
                  <input type="number" step="0.01" min="0.01" className="input" value={duCosto} onChange={e => setDuCosto(e.target.value)} />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap mt-6">
                  <input type="checkbox" checked={duExento} onChange={e => setDuExento(e.target.checked)} className="w-3.5 h-3.5 accent-brand-600" />
                  Exento IVA
                </label>
              </div>
              {duCosto && parseFloat(duCosto) > 0 && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  {duExento
                    ? <>Exento de IVA — saldo a pagar: <strong className="text-gray-900">{Q(parseFloat(duCosto))}</strong></>
                    : <>IVA (12%): <strong>{Q(parseFloat(duCosto) * 0.12)}</strong> · Saldo a pagar sin IVA: <strong className="text-gray-900">{Q(parseFloat(duCosto) * 0.88)}</strong></>}
                </p>
              )}
              <div>
                <label className="label">Razón de adjudicación</label>
                <textarea className="input" rows={2} value={duRazon} onChange={e => setDuRazon(e.target.value)}
                  placeholder="Justificación de por qué se adjudica a este proveedor…" />
              </div>
            </div>
          )}

          {/* Errores */}
          {error && !limitExceeded && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
          {limitExceeded && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div><p className="font-semibold">Total supera el límite</p><p className="mt-0.5">{error}</p></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setLimitExceeded(false); setError(""); }} className="flex-1 btn-secondary justify-center">Corregir</button>
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
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            {tipoCompra === "Compra Directa" && (
              <button onClick={finalizarEnviar} disabled={loading || oferentes.length === 0} className="btn-primary disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />} Enviar a Junta
              </button>
            )}
            {tipoCompra === "Baja Cuantía" && regularizado === false && subTipo === "con_insumos" && (
              <button onClick={finalizarEnviar} disabled={loading || oferentes.length === 0} className="btn-primary disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />} Enviar a Junta
              </button>
            )}
            {tipoCompra === "Baja Cuantía" && regularizado === false && subTipo === "por_servicios" && (
              <button onClick={confirmarServicio} disabled={loading || !cotizId} className="btn-primary disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />} Enviar a Junta
              </button>
            )}
            {tipoCompra === "Baja Cuantía" && regularizado === true && (
              <button onClick={enviarRegularizado} disabled={loading} className="btn-primary disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />} Enviar a Fondo Rotativo
              </button>
            )}
            {(tipoCompra === "Contrato Abierto" || tipoCompra === "Casos de Excepción") && (
              <button onClick={handleAdjudicarDirecto} disabled={loading} className="btn-primary disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />} ADJUDICAR
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
