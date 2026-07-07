"use client";
import { useState } from "react";
import Link from "next/link";
import {
  FileText, X, Loader2, AlertTriangle, CheckCircle2, XCircle,
  Printer, Plus, Gavel,
} from "lucide-react";
import { generarActa, aprobarActa, rechazarActa } from "@/lib/adjudicacion/actas-adjudicacion-actions";

type Acta = {
  id: number; consolidacion_id: number;
  no_formulario: string; no_acta: string; lugar: string; fecha: string; hora: string;
  estado: string; previsualizada: boolean; motivo_rechazo: string | null;
};
type Consolidacion = {
  id: number; numero: number; anio: number; tipo_compra: string | null;
  numero_adjudicacion: string | null; pre_orden: string | null;
  proveedor_nombre: string | null; proveedor_nit: string | null; total: number | null;
};
type Row = { consolidacion: Consolidacion; acta: Acta | null };

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function correlativo(c: Consolidacion) {
  if (c.numero_adjudicacion) return `ADJ-${c.numero_adjudicacion}`;
  if (c.pre_orden) return `PRE-${c.pre_orden}`;
  return `${String(c.numero).padStart(3, "0")}/${c.anio}`;
}

interface Props { rows: Row[]; canEdit: boolean; }

export default function ActaClient({ rows: init, canEdit }: Props) {
  const [rows, setRows] = useState(init);
  const [generarFor, setGenerarFor] = useState<Consolidacion | null>(null);
  const [motivoModal, setMotivoModal] = useState<Acta | null>(null);
  const [procesando, setProcesando] = useState<number | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});

  function updateActa(consolidacionId: number, acta: Acta) {
    setRows(p => p.map(r => r.consolidacion.id === consolidacionId ? { ...r, acta } : r));
  }

  async function handleAprobar(acta: Acta) {
    setProcesando(acta.id); setRowError(p => ({ ...p, [acta.id]: "" }));
    const res = await aprobarActa(acta.id);
    setProcesando(null);
    if ("error" in res) { setRowError(p => ({ ...p, [acta.id]: res.error })); return; }
    // Al aprobarse, la consolidación avanza a Compras/Órdenes y el acta se
    // archiva en Historial — desaparece de esta pestaña.
    setRows(p => p.filter(r => r.consolidacion.id !== acta.consolidacion_id));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5" /> Actas de Adjudicación
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{rows.length} consolidación(es) adjudicada(s)</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Referencia</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Tipo</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Acta</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ consolidacion: c, acta }) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{correlativo(c)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{c.tipo_compra ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    <p className="font-medium">{c.proveedor_nombre ?? "—"}</p>
                    {c.proveedor_nit && <p className="text-gray-400">NIT: {c.proveedor_nit}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">
                    {c.total != null ? Q(c.total) : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {!acta ? (
                      <span className="text-xs text-gray-400">Sin generar</span>
                    ) : acta.estado === "Aprobada" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3" /> Aprobada
                      </span>
                    ) : acta.estado === "Rechazada" ? (
                      <button onClick={() => setMotivoModal(acta)}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
                        <XCircle className="w-3 h-3" /> Rechazada
                      </button>
                    ) : acta.previsualizada ? (
                      <span className="text-xs font-medium text-amber-700">Lista para aprobar</span>
                    ) : (
                      <span className="text-xs text-gray-500">Falta previsualizar</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex flex-col items-end gap-1">
                      {!acta && canEdit && (
                        <button onClick={() => setGenerarFor(c)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                          <Plus className="w-3 h-3" /> Generar Acta
                        </button>
                      )}
                      {acta && acta.estado === "Rechazada" && canEdit && (
                        <button onClick={() => setGenerarFor(c)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                          <Plus className="w-3 h-3" /> Generar Acta
                        </button>
                      )}
                      {acta && acta.estado === "Generada" && (
                        <Link href={`/junta-adjudicadora/acta/${acta.id}/imprimir`}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                          <Printer className="w-3 h-3" /> Previsualizar / Imprimir
                        </Link>
                      )}
                      {acta && acta.estado === "Generada" && acta.previsualizada && canEdit && (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setMotivoModal({ ...acta, motivo_rechazo: "" })}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
                            Rechazar
                          </button>
                          <button onClick={() => handleAprobar(acta)} disabled={procesando === acta.id}
                            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors">
                            {procesando === acta.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Aprobar
                          </button>
                        </div>
                      )}
                      {acta && acta.estado === "Aprobada" && (
                        <Link href={`/junta-adjudicadora/acta/${acta.id}/imprimir`}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                          <Printer className="w-3 h-3" /> Ver / Imprimir
                        </Link>
                      )}
                      {rowError[acta?.id ?? -1] && <p className="text-[10px] text-red-600 max-w-[160px] text-right">{rowError[acta!.id]}</p>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Gavel className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay consolidaciones adjudicadas pendientes de acta.</p>
            </div>
          )}
        </div>
      </div>

      {generarFor && (
        <GenerarActaModal
          consolidacion={generarFor}
          onClose={() => setGenerarFor(null)}
          onCreado={acta => { updateActa(generarFor.id, acta); setGenerarFor(null); }}
        />
      )}

      {motivoModal && (
        <RechazarOVerModal
          acta={motivoModal}
          onClose={() => setMotivoModal(null)}
          onRechazado={acta => { updateActa(acta.consolidacion_id, acta); setMotivoModal(null); }}
        />
      )}
    </div>
  );
}

function GenerarActaModal({ consolidacion: c, onClose, onCreado }: {
  consolidacion: Consolidacion; onClose: () => void; onCreado: (acta: Acta) => void;
}) {
  const now = new Date();
  const [noFormulario, setNoFormulario] = useState("");
  const [noActa, setNoActa] = useState("");
  const [lugar, setLugar] = useState("");
  const [fecha, setFecha] = useState(now.toISOString().slice(0, 10));
  const [hora, setHora] = useState(now.toTimeString().slice(0, 5));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleGuardar() {
    if (!noFormulario.trim()) return setError("El No. de Formulario es obligatorio");
    if (!noActa.trim()) return setError("El No. de Acta es obligatorio");
    if (!lugar.trim()) return setError("El lugar es obligatorio");
    setSaving(true); setError("");
    const res = await generarActa(c.id, { no_formulario: noFormulario.trim(), no_acta: noActa.trim(), lugar: lugar.trim(), fecha, hora });
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onCreado(res.acta as unknown as Acta);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Generar Acta — {correlativo(c)}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="label">No. de Formulario <span className="text-red-500 font-semibold">*</span></label>
            <input className="input font-mono" value={noFormulario} onChange={e => setNoFormulario(e.target.value)} />
          </div>
          <div>
            <label className="label">No. de Acta <span className="text-red-500 font-semibold">*</span></label>
            <input className="input font-mono" value={noActa} onChange={e => setNoActa(e.target.value)} />
          </div>
          <div>
            <label className="label">Lugar (municipio) <span className="text-red-500 font-semibold">*</span></label>
            <input className="input" value={lugar} onChange={e => setLugar(e.target.value)} placeholder="Ej. Tejutla" />
            <p className="text-xs text-gray-400 mt-1">Se usará en la frase &ldquo;En el Municipio de ___, del Departamento de ___&rdquo;.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <label className="label">Hora</label>
              <input type="time" className="input" value={hora} onChange={e => setHora(e.target.value)} />
            </div>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Generar
          </button>
        </div>
      </div>
    </div>
  );
}

function RechazarOVerModal({ acta, onClose, onRechazado }: {
  acta: Acta; onClose: () => void; onRechazado: (acta: Acta) => void;
}) {
  const soloVer = acta.estado === "Rechazada";
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRechazar() {
    if (!motivo.trim()) return setError("El motivo del rechazo es obligatorio");
    setLoading(true); setError("");
    const res = await rechazarActa(acta.id, motivo.trim());
    setLoading(false);
    if ("error" in res) return setError(res.error);
    onRechazado({ ...acta, estado: "Rechazada", motivo_rechazo: motivo.trim() });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600" /> {soloVer ? "Acta rechazada" : "Rechazar acta"}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {soloVer ? (
            <p className="text-sm text-gray-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
              {acta.motivo_rechazo || "—"}
            </p>
          ) : (
            <>
              <label className="label">Motivo del rechazo <span className="text-red-500 font-semibold">*</span></label>
              <textarea className="input min-h-[90px] resize-none text-sm"
                placeholder="Explica por qué se rechaza esta acta…"
                value={motivo} onChange={e => setMotivo(e.target.value)} autoFocus />
            </>
          )}
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">{soloVer ? "Cerrar" : "Cancelar"}</button>
          {!soloVer && (
            <button onClick={handleRechazar} disabled={loading || !motivo.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Confirmar rechazo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
