"use client";
import { useState } from "react";
import { FileCheck, Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { liquidarValePasajes, liquidarValeGastosVarios } from "@/lib/vale-actions";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Vale = { id: number; numero: number; monto: number; monto_autorizado: number | null };
type UsoPasajes = { total: number; polizas: { id: number; numero: number; total: number }[] } | null;

interface Props {
  valePasajes: Vale | null; usoPasajes: UsoPasajes;
  valeGastosVarios: Vale | null; usoGastosVarios: number | null;
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
          detalle={usoPasajes?.polizas.map(p => `Póliza ${p.numero}: ${Q(p.total)}`) ?? []}
          liquidando={liquidandoValePasajes}
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
          totalUsado={usoGastosVarios ?? 0}
          detalle={[]}
          liquidando={liquidandoValeGastos}
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
  titulo, vale, totalUsado, detalle, liquidando, onLiquidar,
}: {
  titulo: string; vale: Vale; totalUsado: number; detalle: string[]; liquidando: boolean;
  onLiquidar: (boleta: { numero_boleta_deposito?: string; monto_boleta_deposito?: number }) => Promise<{ ok: true } | { error: string }>;
}) {
  const monto = vale.monto_autorizado ?? vale.monto;
  const disponible = monto - totalUsado;
  const [modal, setModal] = useState(false);
  const [liquidado, setLiquidado] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{titulo} — Vale {String(vale.numero).padStart(7, "0")}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Total: {Q(monto)} · Usado: {Q(totalUsado)} · Disponible: {Q(disponible)}
          </p>
          {detalle.length > 0 && (
            <p className="text-[11px] text-gray-400 mt-1">{detalle.join(" · ")}</p>
          )}
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
