"use client";
import { useState } from "react";
import { FileCheck, X, Loader2, AlertTriangle, Send } from "lucide-react";
import { devengarYEnviarADab, type DevengarData } from "@/lib/adjudicacion/devengado-actions";
import RenglonBadges from "@/components/RenglonBadges";

type Orden = {
  id: number; numero: number; anio: number; tipo_compra: string;
  proveedor_nit: string | null; proveedor_nombre: string | null;
  total: number | null; codigo_ppr: string | null; no_compromiso: string | null;
  renglones: { renglon: number | null; subproducto: string; nombre: string; cantidad: number }[];
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CAMPOS: { key: keyof DevengarData; label: string; tipo: "date" | "text" }[] = [
  { key: "fecha_ingreso_producto", label: "Fecha de ingreso del producto", tipo: "date" },
  { key: "no_factura",             label: "No. Factura",                  tipo: "text" },
  { key: "serie_factura",          label: "Serie de factura",             tipo: "text" },
  { key: "fecha_emision",          label: "Fecha de emisión",             tipo: "date" },
  { key: "lote",                   label: "Lote",                        tipo: "text" },
  { key: "fecha_vencimiento",      label: "Fecha de vencimiento",         tipo: "date" },
  { key: "marca",                  label: "Marca",                       tipo: "text" },
  { key: "modelo",                 label: "Modelo",                      tipo: "text" },
  { key: "serie",                  label: "Serie",                       tipo: "text" },
  { key: "no_devengado",           label: "No. Devengado",               tipo: "text" },
];

export default function DevengadoClient({ ordenes: init }: { ordenes: Orden[] }) {
  const [ordenes, setOrdenes] = useState(init);
  const [devengarFor, setDevengarFor] = useState<Orden | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileCheck className="w-5 h-5" /> Presupuesto — Devengado
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{ordenes.length} orden(es) pendiente(s) de devengar</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Orden</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Compromiso</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ordenes.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                    OC-{String(o.numero).padStart(3, "0")}/{o.anio}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{o.no_compromiso ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{o.proveedor_nombre ?? "—"}</p>
                    {o.proveedor_nit && <p className="text-xs text-gray-400">NIT: {o.proveedor_nit}</p>}
                    <RenglonBadges renglones={o.renglones} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                    {o.total != null ? Q(o.total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setDevengarFor(o)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors ml-auto">
                      <FileCheck className="w-3 h-3" /> Devengar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ordenes.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay órdenes pendientes de devengar.</p>
            </div>
          )}
        </div>
      </div>

      {devengarFor && (
        <DevengarModal
          orden={devengarFor}
          onClose={() => setDevengarFor(null)}
          onDone={() => { setOrdenes(p => p.filter(o => o.id !== devengarFor.id)); setDevengarFor(null); }}
        />
      )}
    </div>
  );
}

function DevengarModal({ orden: o, onClose, onDone }: { orden: Orden; onClose: () => void; onDone: () => void }) {
  const [data, setData] = useState<DevengarData>({
    fecha_ingreso_producto: "", no_factura: "", serie_factura: "", fecha_emision: "",
    lote: "", fecha_vencimiento: "", marca: "", modelo: "", serie: "", no_devengado: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof DevengarData, value: string) {
    setData(p => ({ ...p, [key]: value }));
  }

  async function handleEnviar() {
    setSaving(true); setError("");
    const res = await devengarYEnviarADab(o.id, data);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Devengar — OC-{String(o.numero).padStart(3, "0")}/{o.anio}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 grid grid-cols-2 gap-3">
          {CAMPOS.map(({ key, label, tipo }) => (
            <div key={key} className={tipo === "date" ? "" : "col-span-2 sm:col-span-1"}>
              <label className="label">{label}</label>
              <input type={tipo} className="input" value={data[key]} onChange={e => set(key, e.target.value)} />
            </div>
          ))}
          {error && (
            <div className="col-span-2 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleEnviar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar a DAB
          </button>
        </div>
      </div>
    </div>
  );
}
