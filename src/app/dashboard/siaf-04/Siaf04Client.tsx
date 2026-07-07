"use client";
import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, FileText, Loader2, CheckCircle2, X } from "lucide-react";
import { generarSiaf04 } from "@/lib/adjudicacion/siaf04-actions";
import type { Consolidacion } from "@/lib/adjudicacion/types";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props { consolidaciones: Consolidacion[]; }

export default function Siaf04Client({ consolidaciones: init }: Props) {
  const [consolidaciones, setConsolidaciones] = useState(init);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modalFor, setModalFor] = useState<Consolidacion | null>(null);

  if (consolidaciones.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-lg mx-auto mt-10">
        <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Sin compras pendientes</h2>
        <p className="text-sm text-gray-500">No hay compras Regularizado esperando su SIAF-04.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5" /> Fondo Rotativo — SIAF-04
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{consolidaciones.length} compra(s) esperando generar su SIAF-04</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Referencia</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Tipo</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {consolidaciones.map(c => {
                const expanded = expandedId === c.id;
                const ref = c.pre_orden ? `PRE-${c.pre_orden}` : `${c.numero}/${c.anio}`;
                return (
                  <Fragment key={c.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(p => p === c.id ? null : c.id)}>
                      <td className="px-4 py-3 text-gray-400">{expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{ref}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{c.tipo_compra ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        <p className="font-medium">{c.proveedor_nombre ?? "—"}</p>
                        {c.proveedor_nit && <p className="text-gray-400">NIT: {c.proveedor_nit}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                        {c.total != null ? Q(c.total) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setModalFor(c)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                          <FileText className="w-3 h-3" /> Generar SIAF
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-brand-50/30">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="space-y-1 text-xs text-gray-600">
                            <p><span className="font-semibold">IVA:</span> {c.exento_iva ? "Exento" : "Con descuento 12%"}</p>
                            <p><span className="font-semibold">SIAFs:</span> {c.siaf.map(s => `${s.numero}/${s.anio}`).join(", ")}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalFor && (
        <GenerarSiafModal
          consolidacion={modalFor}
          onClose={() => setModalFor(null)}
          onDone={() => {
            setConsolidaciones(p => p.filter(c => c.id !== modalFor.id));
            setModalFor(null);
          }}
        />
      )}
    </div>
  );
}

function GenerarSiafModal({ consolidacion: c, onClose, onDone }: {
  consolidacion: Consolidacion; onClose: () => void; onDone: () => void;
}) {
  const router = useRouter();
  const [noFactura, setNoFactura] = useState("");
  const [serie, setSerie] = useState("");
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerar() {
    if (!noFactura.trim() || !serie.trim() || !fechaEmision) {
      setError("No. de Factura, Serie y Fecha de Emisión son obligatorios");
      return;
    }
    setLoading(true); setError("");
    const res = await generarSiaf04(c.id, { no_factura: noFactura.trim(), serie_factura: serie.trim(), fecha_emision: fechaEmision });
    setLoading(false);
    if ("error" in res) { setError(res.error); return; }
    onDone();
    router.push(`/compras/adjudicacion/${c.id}/imprimir-a04`);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-600" /> Generar SIAF-04
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Se asignará el correlativo A-04 SIAF automáticamente</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">No. de Factura</label>
              <input className="input font-mono" value={noFactura} onChange={e => setNoFactura(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Serie</label>
              <input className="input font-mono" value={serie} onChange={e => setSerie(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Fecha de Emisión</label>
            <input type="date" className="input" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleGenerar} disabled={loading} className="btn-primary disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Generar e imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
