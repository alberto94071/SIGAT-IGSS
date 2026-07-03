"use client";
import { useState } from "react";
import { Hash, Plus, X, Loader2, Trash2, Building2, DollarSign } from "lucide-react";
import { crearNog, eliminarNog } from "@/lib/nog-actions";
import NitAutocomplete from "@/components/adjudicacion/NitAutocomplete";
import InsumoAutocomplete from "@/components/InsumoAutocomplete";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type NogRow = {
  id: number; nog: string;
  proveedor_id: number | null; proveedor_nit: string | null; proveedor_nombre: string;
  insumo_id: number | null; insumo_nombre: string; insumo_codigo_igss: string | null;
  subproducto: string | null; cantidad_autorizada: number;
  precio: number | null; exento_iva: boolean; total: number | null;
};

interface Props { nogs: NogRow[]; canEdit: boolean; }

export default function NogClient({ nogs: init, canEdit }: Props) {
  const [nogs, setNogs] = useState(init);
  const [modal, setModal] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  function handleCreado(nuevo: NogRow) {
    setNogs(p => [nuevo, ...p]);
    setModal(false);
  }

  async function handleEliminar(id: number) {
    if (!confirm("¿Eliminar este registro de NOG?")) return;
    setRemovingId(id);
    const res = await eliminarNog(id);
    setRemovingId(null);
    if ("error" in res) { alert(res.error); return; }
    setNogs(p => p.filter(n => n.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Hash className="w-5 h-5" /> Registro de NOG
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {nogs.length.toLocaleString("es-GT")} NOG(s) registrado(s) — Números de Operación de Guatecompras
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Agregar NOG
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">NOG</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-left">Insumo</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Cantidad Autorizada</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Precio</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">IVA</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                {canEdit && <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {nogs.map(n => (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{n.nog}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{n.proveedor_nombre}</p>
                    {n.proveedor_nit && <p className="text-xs text-gray-400">NIT: {n.proveedor_nit}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">{n.insumo_nombre}</p>
                    <p className="text-xs text-gray-400">
                      {n.insumo_codigo_igss && `Código: ${n.insumo_codigo_igss} · `}
                      {n.subproducto && `Subproducto: ${n.subproducto}`}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">
                    {n.cantidad_autorizada.toLocaleString("es-GT")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 whitespace-nowrap">
                    {n.precio != null ? Q(n.precio) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${n.exento_iva ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {n.exento_iva ? "Exento" : "Con IVA (12%)"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                    {n.total != null ? Q(n.total) : "—"}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEliminar(n.id)} disabled={removingId === n.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        {removingId === n.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {nogs.length === 0 && (
            <div className="text-center py-12 text-gray-400">No hay NOG registrados</div>
          )}
        </div>
      </div>

      {modal && <AgregarNogModal onClose={() => setModal(false)} onCreado={handleCreado} />}
    </div>
  );
}

function AgregarNogModal({ onClose, onCreado }: { onClose: () => void; onCreado: (n: NogRow) => void }) {
  const [nog, setNog] = useState("");
  const [nit, setNit] = useState("");
  const [proveedorNombre, setProveedorNombre] = useState("");
  const [proveedorId, setProveedorId] = useState<number | null>(null);
  const [insumoQuery, setInsumoQuery] = useState("");
  const [insumoId, setInsumoId] = useState<number | null>(null);
  const [insumoNombre, setInsumoNombre] = useState("");
  const [insumoCodigo, setInsumoCodigo] = useState<string | null>(null);
  const [subproducto, setSubproducto] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [exentoIva, setExentoIva] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cantidadNum = parseFloat(cantidad);
  const precioNum = parseFloat(precio);
  const totalPreview = cantidadNum > 0 && precioNum > 0
    ? (exentoIva ? cantidadNum * precioNum : cantidadNum * precioNum * 0.88)
    : null;

  async function handleGuardar() {
    if (!nog.trim()) return setError("El número de NOG es obligatorio");
    if (!proveedorNombre.trim()) return setError("Selecciona o escribe el proveedor");
    if (!insumoNombre.trim()) return setError("Selecciona el insumo");
    if (!(cantidadNum > 0)) return setError("Ingresa una cantidad autorizada válida");
    if (!(precioNum > 0)) return setError("Ingresa un precio válido");

    setSaving(true); setError("");
    const res = await crearNog({
      nog: nog.trim(),
      proveedor_id: proveedorId, proveedor_nit: nit.trim() || null, proveedor_nombre: proveedorNombre.trim(),
      insumo_id: insumoId, insumo_nombre: insumoNombre.trim(), insumo_codigo_igss: insumoCodigo, subproducto,
      cantidad_autorizada: cantidadNum, precio: precioNum, exento_iva: exentoIva,
    });
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onCreado(res.nog as unknown as NogRow);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Agregar NOG</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="label">Número de NOG <span className="text-red-500 font-semibold">*</span></label>
            <input className="input font-mono" value={nog} onChange={e => setNog(e.target.value)} placeholder="Ej. 12345678" />
          </div>

          <div>
            <label className="label flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Proveedor (NIT o nombre)</label>
            <NitAutocomplete
              value={nit}
              onChange={v => { setNit(v); setProveedorId(null); }}
              onSelect={p => { setNit(p.nit ?? nit); setProveedorNombre(p.nombre); setProveedorId(p.id); }}
            />
          </div>
          <div>
            <label className="label">Nombre del proveedor</label>
            <input className="input" value={proveedorNombre} onChange={e => setProveedorNombre(e.target.value)} />
          </div>

          <div>
            <label className="label">Insumo <span className="text-red-500 font-semibold">*</span></label>
            <InsumoAutocomplete
              value={insumoQuery}
              onChange={v => { setInsumoQuery(v); setInsumoId(null); }}
              onSelect={i => {
                setInsumoQuery(i.nombre); setInsumoId(i.id); setInsumoNombre(i.nombre);
                setInsumoCodigo(i.codigo_igss); setSubproducto(i.subproducto);
              }}
            />
            {insumoId && (
              <p className="text-xs text-green-700 mt-1">✓ {insumoNombre} {insumoCodigo && `(Código: ${insumoCodigo})`}</p>
            )}
          </div>

          <div>
            <label className="label">Cantidad autorizada <span className="text-red-500 font-semibold">*</span></label>
            <input type="number" step="0.01" min="0.01" className="input" value={cantidad} onChange={e => setCantidad(e.target.value)} />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <label className="label flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Precio <span className="text-red-500 font-semibold">*</span></label>
              <input type="number" step="0.01" min="0.01" className="input" value={precio} onChange={e => setPrecio(e.target.value)} />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap mt-6">
              <input type="checkbox" checked={exentoIva} onChange={e => setExentoIva(e.target.checked)} className="w-3.5 h-3.5 accent-brand-600" />
              Exento IVA
            </label>
          </div>

          {totalPreview != null && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              {exentoIva
                ? <>Exento de IVA — Total: <strong className="text-gray-900">{Q(totalPreview)}</strong></>
                : <>Con IVA (se descuenta 12%) — Total: <strong className="text-gray-900">{Q(totalPreview)}</strong></>}
            </p>
          )}

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Guardar NOG
          </button>
        </div>
      </div>
    </div>
  );
}
