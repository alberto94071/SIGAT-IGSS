"use client";
import { useState } from "react";
import { FileCheck, Loader2, CheckCircle2, AlertTriangle, X, ChevronDown, ChevronRight } from "lucide-react";
import { liquidarValePasajes, liquidarValeGastosVarios } from "@/lib/vale-actions";
import TrazabilidadPanel from "@/components/TrazabilidadPanel";
import type { TrazabilidadConsolidacion } from "@/lib/adjudicacion/trazabilidad-utils";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Vale = { id: number; numero: number; monto: number; monto_autorizado: number | null };
type UsoPasajes = { total: number; polizas: { id: number; numero: number; total: number }[] } | null;
type PagoGastoVario = { id: number; destinatario_nombre: string | null; total: number | null; numero_a04: number | null; anio_a04: number | null; traz: TrazabilidadConsolidacion | null };
type UsoGastosVarios = { total: number; pagos: PagoGastoVario[] } | null;

interface Props {
  valePasajes: Vale | null; usoPasajes: UsoPasajes;
  valeGastosVarios: Vale | null; usoGastosVarios: UsoGastosVarios;
}

export default function LiquidacionClient({ valePasajes, usoPasajes, valeGastosVarios, usoGastosVarios }: Props) {
  const [liquidandoValePasajes, setLiquidandoValePasajes] = useState(false);
  const [liquidandoValeGastos, setLiquidandoValeGastos] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileCheck className="w-5 h-5" /> Liquidación
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Liquida los vales activos.</p>
      </div>

      {valePasajes && (
        <ValeCard
          titulo="Vale de Pago de Pasajes"
          vale={valePasajes}
          totalUsado={usoPasajes?.total ?? 0}
          liquidando={liquidandoValePasajes}
          detallePasajes={usoPasajes?.polizas ?? []}
          onLiquidar={async (boleta) => {
            setLiquidandoValePasajes(true);
            const res = await liquidarValePasajes(valePasajes.id, boleta);
            setLiquidandoValePasajes(false);
            return res;
          }}
        />
      )}

      {valeGastosVarios && (
        <ValeCard
          titulo="Vale de Gastos Varios"
          vale={valeGastosVarios}
          totalUsado={usoGastosVarios?.total ?? 0}
          liquidando={liquidandoValeGastos}
          detallePagos={usoGastosVarios?.pagos ?? []}
          onLiquidar={async (boleta) => {
            setLiquidandoValeGastos(true);
            const res = await liquidarValeGastosVarios(valeGastosVarios.id, boleta);
            setLiquidandoValeGastos(false);
            return res;
          }}
        />
      )}
    </div>
  );
}

function ValeCard({
  titulo, vale, totalUsado, liquidando, onLiquidar, detallePasajes, detallePagos,
}: {
  titulo: string; vale: Vale; totalUsado: number; liquidando: boolean;
  onLiquidar: (boleta: { numero_boleta_deposito?: string; monto_boleta_deposito?: number }) => Promise<{ ok: true } | { error: string }>;
  detallePasajes?: { id: number; numero: number; total: number }[];
  detallePagos?: PagoGastoVario[];
}) {
  const monto = vale.monto_autorizado ?? vale.monto;
  const disponible = monto - totalUsado;
  const [modal, setModal] = useState(false);
  const [liquidado, setLiquidado] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [expandedPago, setExpandedPago] = useState<number | null>(null);
  const hayDetalle = (detallePasajes && detallePasajes.length > 0) || (detallePagos && detallePagos.length > 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div
          className={`flex items-start gap-2 ${hayDetalle ? "cursor-pointer" : ""}`}
          onClick={() => hayDetalle && setExpandido(p => !p)}>
          {hayDetalle && (
            <span className="text-gray-400 mt-0.5">
              {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900">{titulo} — Vale {String(vale.numero).padStart(7, "0")}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Total: {Q(monto)} · Usado: {Q(totalUsado)} · Disponible: {Q(disponible)}
            </p>
          </div>
        </div>
        {liquidado ? (
          <span className="flex items-center gap-1.5 text-sm text-green-700"><CheckCircle2 className="w-4 h-4" /> Liquidado</span>
        ) : (
          <button onClick={() => setModal(true)} disabled={liquidando}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {liquidando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />} Liquidar Vale
          </button>
        )}
      </div>

      {expandido && detallePasajes && detallePasajes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          {detallePasajes.map(p => (
            <p key={p.id} className="text-xs text-gray-600">Póliza {p.numero}: <span className="font-mono font-semibold">{Q(p.total)}</span></p>
          ))}
        </div>
      )}

      {expandido && detallePagos && detallePagos.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          {detallePagos.map(p => {
            const rowExpanded = expandedPago === p.id;
            return (
              <div key={p.id} className="rounded-lg border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedPago(prev => prev === p.id ? null : p.id)}>
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    {rowExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                    <span className="font-mono font-semibold">{p.numero_a04 != null ? `A-04 ${p.numero_a04}/${p.anio_a04}` : "—"}</span>
                    <span className="text-gray-400">{p.destinatario_nombre ?? "—"}</span>
                  </div>
                  <span className="font-mono font-semibold text-gray-900">{p.total != null ? Q(p.total) : "—"}</span>
                </div>
                {rowExpanded && (
                  <div className="px-3 py-2 bg-gray-50">
                    <TrazabilidadPanel titulo={`Detalle de A-04 ${p.numero_a04 ?? ""}/${p.anio_a04 ?? ""}`} traz={p.traz} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <LiquidarModal
          disponible={disponible}
          onClose={() => setModal(false)}
          onConfirmar={async (boleta) => {
            const res = await onLiquidar(boleta);
            if ("error" in res) return res;
            setLiquidado(true);
            setModal(false);
            return res;
          }}
        />
      )}
    </div>
  );
}

function LiquidarModal({
  disponible, onClose, onConfirmar,
}: { disponible: number; onClose: () => void; onConfirmar: (boleta: { numero_boleta_deposito?: string; monto_boleta_deposito?: number }) => Promise<{ ok: true } | { error: string }> }) {
  const hayRemanente = disponible > 0.009;
  const [numeroBoleta, setNumeroBoleta] = useState("");
  const [montoBoleta, setMontoBoleta] = useState(hayRemanente ? disponible.toFixed(2) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirmar() {
    setSaving(true); setError("");
    const res = await onConfirmar({
      numero_boleta_deposito: hayRemanente ? numeroBoleta : undefined,
      monto_boleta_deposito: hayRemanente ? parseFloat(montoBoleta) : undefined,
    });
    setSaving(false);
    if ("error" in res) return setError(res.error);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Liquidar Vale</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        {hayRemanente ? (
          <>
            <p className="text-sm text-gray-600">
              Sobró {Q(disponible)} de efectivo. Ingresa la boleta de depósito por ese monto para regresarlo al Fondo Rotativo.
            </p>
            <div>
              <label className="label">No. de boleta de depósito</label>
              <input className="input font-mono" value={numeroBoleta} onChange={e => setNumeroBoleta(e.target.value)} />
            </div>
            <div>
              <label className="label">Monto depositado</label>
              <input type="number" step="0.01" className="input" value={montoBoleta} onChange={e => setMontoBoleta(e.target.value)} />
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-600">Se usó el monto completo del vale. No se necesita boleta de depósito.</p>
        )}
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleConfirmar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />} Liquidar
          </button>
        </div>
      </div>
    </div>
  );
}
