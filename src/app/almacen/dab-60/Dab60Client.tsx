"use client";
import { useState } from "react";
import { Archive, X, Loader2, Send } from "lucide-react";
import { generarDab60, type Dab60Data } from "@/lib/adjudicacion/dab60-actions";
import RenglonBadges from "@/components/RenglonBadges";

type Orden = {
  id: number; numero: number; anio: number;
  proveedor_nit: string | null; proveedor_nombre: string | null;
  total: number | null; no_compromiso: string | null;
  renglones: { renglon: number | null; subproducto: string; nombre: string; cantidad: number }[];
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CAMPOS: { key: keyof Dab60Data; label: string; tipo: "date" | "text" }[] = [
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

export default function Dab60Client({ ordenes: init }: { ordenes: Orden[] }) {
  const [ordenes, setOrdenes] = useState(init);
  const [dabFor, setDabFor] = useState<Orden | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Archive className="w-5 h-5" /> DAB-60
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{ordenes.length} orden(es) pendiente(s) de ingresar a Almacén</p>
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
                    <button onClick={() => setDabFor(o)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors ml-auto">
                      <Archive className="w-3 h-3" /> Generar DAB-60
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ordenes.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay órdenes pendientes de ingresar a Almacén.</p>
            </div>
          )}
        </div>
      </div>

      {dabFor && (
        <Dab60Modal
          orden={dabFor}
          onClose={() => setDabFor(null)}
          onDone={() => { setOrdenes(p => p.filter(o => o.id !== dabFor.id)); setDabFor(null); }}
        />
      )}
    </div>
  );
}

function Dab60Modal({ orden: o, onClose, onDone }: { orden: Orden; onClose: () => void; onDone: () => void }) {
  const [data, setData] = useState<Dab60Data>({
    fecha_ingreso_producto: "", no_factura: "", serie_factura: "", fecha_emision: "",
    lote: "", fecha_vencimiento: "", marca: "", modelo: "", serie: "", no_devengado: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof Dab60Data, value: string) {
    setData(p => ({ ...p, [key]: value }));
  }

  async function handleEnviar() {
    setSaving(true); setError("");
    const res = await generarDab60(o.id, data);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">DAB-60 — OC-{String(o.numero).padStart(3, "0")}/{o.anio}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 grid grid-cols-2 gap-3">
          <p className="col-span-2 text-xs text-gray-400 -mt-1 mb-1">
            Todos estos datos son opcionales — puedes dejarlos en blanco y completarlos después.
          </p>
          {CAMPOS.map(({ key, label, tipo }) => (
            <div key={key} className={tipo === "date" ? "" : "col-span-2 sm:col-span-1"}>
              <label className="label">{label}</label>
              <input type={tipo} className="input" value={data[key]} onChange={e => set(key, e.target.value)} />
            </div>
          ))}
          {error && (
            <div className="col-span-2 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleEnviar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Generar DAB-60
          </button>
        </div>
      </div>
    </div>
  );
}
