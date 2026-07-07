"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Plus, X, Loader2, AlertTriangle, Printer, Trash2 } from "lucide-react";
import { crearRequisicion, type ItemRequisicion } from "./actions";

type Requisicion = {
  id: number; no_pedido: string; fecha_emision: string; sala_servicio: string; bodega: string;
  items: { codigo: string; nombre: string; cantidad_solicitada: number }[];
};

export default function Dab75Client({ requisiciones: init, canEdit }: { requisiciones: Requisicion[]; canEdit: boolean }) {
  const router = useRouter();
  const [requisiciones, setRequisiciones] = useState(init);
  const [modal, setModal] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Archive className="w-5 h-5" /> DAB-75 — Requisición a Bodega Local
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{requisiciones.length} requisición(es) registrada(s)</p>
        </div>
        {canEdit && (
          <button onClick={() => setModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nueva Requisición
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Pedido</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha Emisión</th>
                <th className="px-4 py-3 text-left">Sala o Servicio</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Bodega</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Insumos</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requisiciones.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{r.no_pedido}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.fecha_emision}</td>
                  <td className="px-4 py-3 text-gray-700">{r.sala_servicio}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">Bodega {r.bodega}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.items.length} insumo(s)</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/almacen/dab-75/${r.id}/imprimir`}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors ml-auto w-fit">
                      <Printer className="w-3 h-3" /> Imprimir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {requisiciones.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aún no se ha registrado ninguna requisición.</p>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <NuevaRequisicionModal
          onClose={() => setModal(false)}
          onCreado={(id) => { setModal(false); router.push(`/almacen/dab-75/${id}/imprimir`); }}
        />
      )}
    </div>
  );
}

function nuevoItem(): ItemRequisicion { return { codigo: "", nombre: "", cantidad_solicitada: 0 }; }

function NuevaRequisicionModal({ onClose, onCreado }: { onClose: () => void; onCreado: (id: number) => void }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [noPedido, setNoPedido] = useState("");
  const [fechaEmision, setFechaEmision] = useState(hoy);
  const [claveAdmin, setClaveAdmin] = useState("");
  const [salaServicio, setSalaServicio] = useState("");
  const [bodega, setBodega] = useState<"I" | "II">("I");
  const [fechaDespacho, setFechaDespacho] = useState("");
  const [items, setItems] = useState<ItemRequisicion[]>([nuevoItem()]);

  const [solNombre, setSolNombre] = useState(""); const [solEmpleado, setSolEmpleado] = useState(""); const [solCargo, setSolCargo] = useState("");
  const [entNombre, setEntNombre] = useState(""); const [entEmpleado, setEntEmpleado] = useState(""); const [entCargo, setEntCargo] = useState("");
  const [recNombre, setRecNombre] = useState(""); const [recEmpleado, setRecEmpleado] = useState(""); const [recCargo, setRecCargo] = useState("");
  const [directorNombre, setDirectorNombre] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateItem(i: number, patch: Partial<ItemRequisicion>) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function addItem() { if (items.length < 14) setItems(prev => [...prev, nuevoItem()]); }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)); }

  async function handleGuardar() {
    if (!noPedido.trim()) return setError("El No. de Pedido es obligatorio");
    if (!claveAdmin.trim()) return setError("La Clave Administrativa es obligatoria");
    if (!salaServicio.trim()) return setError("La Sala o Servicio es obligatoria");
    if (!solNombre.trim() || !solEmpleado.trim() || !solCargo.trim()) return setError("Los datos de quien Solicita son obligatorios");
    const validItems = items.filter(i => i.codigo.trim() || i.nombre.trim());
    if (validItems.length === 0) return setError("Agrega al menos un insumo");
    for (const it of validItems) {
      if (!it.codigo.trim() || !it.nombre.trim()) return setError("Todos los insumos deben tener Código y Nombre");
      if (!(it.cantidad_solicitada > 0)) return setError("La cantidad solicitada debe ser mayor a cero");
    }

    setSaving(true); setError("");
    const res = await crearRequisicion({
      no_pedido: noPedido, fecha_emision: fechaEmision, clave_administrativa: claveAdmin,
      sala_servicio: salaServicio, bodega, fecha_despacho: fechaDespacho,
      solicita_nombre: solNombre, solicita_no_empleado: solEmpleado, solicita_cargo: solCargo,
      entrega_nombre: entNombre, entrega_no_empleado: entEmpleado, entrega_cargo: entCargo,
      recibe_nombre: recNombre, recibe_no_empleado: recEmpleado, recibe_cargo: recCargo,
      director_nombre: directorNombre,
      items: validItems,
    });
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onCreado(res.id);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Nueva Requisición a Bodega Local (DAB-75)</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">No. de Pedido</label>
              <input className="input font-mono" value={noPedido} onChange={e => setNoPedido(e.target.value)} />
            </div>
            <div>
              <label className="label">Fecha de Emisión</label>
              <input type="date" className="input" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} />
            </div>
            <div>
              <label className="label">Clave Administrativa</label>
              <input className="input" value={claveAdmin} onChange={e => setClaveAdmin(e.target.value)} />
            </div>
            <div>
              <label className="label">Fecha de Despacho</label>
              <input type="date" className="input" value={fechaDespacho} onChange={e => setFechaDespacho(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Sala o Servicio</label>
              <input className="input" value={salaServicio} onChange={e => setSalaServicio(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="radio" checked={bodega === "I"} onChange={() => setBodega("I")} className="accent-brand-600" /> Bodega I
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="radio" checked={bodega === "II"} onChange={() => setBodega("II")} className="accent-brand-600" /> Bodega II
            </label>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Insumos</p>
            {items.length < 14 && (
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
                <Plus className="w-3 h-3" /> Agregar insumo
              </button>
            )}
          </div>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input placeholder="Código" className="input col-span-3 font-mono text-xs"
                  value={it.codigo} onChange={e => updateItem(i, { codigo: e.target.value })} />
                <input placeholder="Nombre genérico y presentación" className="input col-span-6 text-xs"
                  value={it.nombre} onChange={e => updateItem(i, { nombre: e.target.value })} />
                <input type="number" min="0" step="0.01" placeholder="Cant." className="input col-span-2 text-xs"
                  value={it.cantidad_solicitada || ""} onChange={e => updateItem(i, { cantidad_solicitada: parseFloat(e.target.value) || 0 })} />
                <button onClick={() => removeItem(i)} className="col-span-1 p-1.5 text-gray-400 hover:text-red-600" disabled={items.length === 1}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider pt-1">Solicita</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="label">Nombre</label>
              <input className="input" value={solNombre} onChange={e => setSolNombre(e.target.value)} />
            </div>
            <div><label className="label">No. Empleado</label><input className="input font-mono" value={solEmpleado} onChange={e => setSolEmpleado(e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Cargo</label><input className="input" value={solCargo} onChange={e => setSolCargo(e.target.value)} /></div>
          </div>

          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider pt-1">Entrega (opcional — puede llenarse al despachar)</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="label">Nombre</label>
              <input className="input" value={entNombre} onChange={e => setEntNombre(e.target.value)} />
            </div>
            <div><label className="label">No. Empleado</label><input className="input font-mono" value={entEmpleado} onChange={e => setEntEmpleado(e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Cargo</label><input className="input" value={entCargo} onChange={e => setEntCargo(e.target.value)} /></div>
          </div>

          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider pt-1">Recibe (opcional — puede llenarse al despachar)</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="label">Nombre</label>
              <input className="input" value={recNombre} onChange={e => setRecNombre(e.target.value)} />
            </div>
            <div><label className="label">No. Empleado</label><input className="input font-mono" value={recEmpleado} onChange={e => setRecEmpleado(e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Cargo</label><input className="input" value={recCargo} onChange={e => setRecCargo(e.target.value)} /></div>
          </div>

          <div>
            <label className="label">Vo.Bo. Director — Nombre (opcional)</label>
            <input className="input" value={directorNombre} onChange={e => setDirectorNombre(e.target.value)} />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Registrar y ver impresión
          </button>
        </div>
      </div>
    </div>
  );
}
