"use client";
import { useState } from "react";
import { Gavel, X, Loader2, AlertTriangle, XCircle, Hash } from "lucide-react";
import ConsolidacionesTable, { correlativo } from "./ConsolidacionesTable";
import OferentesEditor from "./OferentesEditor";
import { adjudicarJunta, rechazarJunta } from "@/lib/adjudicacion/junta-actions";
import type { Consolidacion } from "@/lib/adjudicacion/types";

interface Props { consolidaciones: Consolidacion[]; canEdit: boolean; }

export default function JuntaAdjudicacionClient({ consolidaciones: init, canEdit }: Props) {
  const [consolidaciones, setConsolidaciones] = useState(init);
  const [revisarFor, setRevisarFor] = useState<Consolidacion | null>(null);
  const [motivoFor,  setMotivoFor]  = useState<Consolidacion | null>(null);

  function updateConsolidacion(id: number, patch: Partial<Consolidacion>) {
    setConsolidaciones(p => p.map(c => c.id === id ? { ...c, ...patch } : c));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Gavel className="w-5 h-5" /> Adjudicaciones — Junta Adjudicadora
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{consolidaciones.length} consolidación(es)</p>
      </div>

      <ConsolidacionesTable
        consolidaciones={consolidaciones}
        onVerMotivo={setMotivoFor}
        acciones={c => (
          <>
            {canEdit && c.estado === "Enviado a Junta" && (
              <button onClick={() => setRevisarFor(c)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                <Gavel className="w-3 h-3" /> Revisar
              </button>
            )}
          </>
        )}
      />

      {revisarFor && (
        <RevisarModal
          consolidacion={revisarFor}
          onClose={() => setRevisarFor(null)}
          onDone={patch => { updateConsolidacion(revisarFor.id, patch); setRevisarFor(null); }}
        />
      )}

      {motivoFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" /> {correlativo(motivoFor)} — Rechazado
              </h2>
              <button onClick={() => setMotivoFor(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              <p className="text-gray-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
                {motivoFor.motivo_rechazo || "—"}
              </p>
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

function RevisarModal({ consolidacion: c, onClose, onDone }: {
  consolidacion: Consolidacion; onClose: () => void; onDone: (patch: Partial<Consolidacion>) => void;
}) {
  const [ganadorId, setGanadorId] = useState<number | null>(c.oferente_ganador_id);
  const [numAdj,    setNumAdj]    = useState(c.numero_adjudicacion ?? "");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [rechazarModal, setRechazarModal] = useState(false);
  const [motivo,    setMotivo]    = useState("");

  async function handleAdjudicar() {
    if (!ganadorId) return setError("Selecciona al oferente ganador");
    if (!numAdj.trim()) return setError("La razón de adjudicación es obligatoria");
    setLoading(true); setError("");
    const res = await adjudicarJunta(c.id, { oferenteId: ganadorId, numero_adjudicacion: numAdj.trim() });
    setLoading(false);
    if ("error" in res) return setError(res.error);
    const ganador = c.oferentes.find(o => o.id === ganadorId);
    onDone({
      estado: "Adjudicado", oferente_ganador_id: ganadorId, numero_adjudicacion: numAdj.trim(),
      proveedor_id: ganador?.proveedor_id ?? null, proveedor_nit: ganador?.nit ?? null, proveedor_nombre: ganador?.nombre ?? null,
    });
  }

  async function handleRechazar() {
    if (!motivo.trim()) return setError("El motivo del rechazo es obligatorio");
    setLoading(true); setError("");
    const res = await rechazarJunta(c.id, motivo.trim());
    setLoading(false);
    if ("error" in res) return setError(res.error);
    onDone({ estado: "Rechazado por Junta", motivo_rechazo: motivo.trim() });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Gavel className="w-4 h-4 text-amber-600" /> Revisar Adjudicación
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{correlativo(c)} · {c.siaf.length} SIAF(s)</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        {!rechazarModal ? (
          <>
            <div className="px-5 py-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Elige al oferente ganador
                </p>
                <OferentesEditor oferentes={c.oferentes} maxOferentes={c.oferentes.length}
                  selectable selectedId={ganadorId} onSelect={setGanadorId} />
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Razón de Adjudicación</label>
                <input className="input" value={numAdj}
                  onChange={e => setNumAdj(e.target.value)} placeholder="Justificación de por qué se adjudica a este oferente…" />
              </div>
              {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
              )}
            </div>
            <div className="flex justify-between gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => { setRechazarModal(true); setError(""); }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                <XCircle className="w-4 h-4" /> Rechazar
              </button>
              <div className="flex gap-2">
                <button onClick={onClose} className="btn-secondary">Cancelar</button>
                <button onClick={handleAdjudicar} disabled={loading || !ganadorId || !numAdj.trim()} className="btn-primary disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />} Adjudicar
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="px-5 py-5 space-y-3">
              <label className="label">Motivo del rechazo <span className="text-red-500 font-semibold">*</span></label>
              <textarea className="input min-h-[90px] resize-none text-sm"
                placeholder="Explica por qué se rechaza esta adjudicación…"
                value={motivo} onChange={e => setMotivo(e.target.value)} autoFocus />
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => { setRechazarModal(false); setError(""); }} className="btn-secondary">Atrás</button>
              <button onClick={handleRechazar} disabled={loading || !motivo.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Confirmar rechazo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
