"use client";
import { useState } from "react";
import { FileText, Plus, X, Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { crearCotizacionServicio, eliminarCotizacionServicio } from "@/lib/adjudicacion/cotizaciones-actions";
import { Q } from "@/components/adjudicacion/ConsolidacionesTable";
import type { CotizacionServicio } from "@/lib/adjudicacion/types";

interface Props { cotizaciones: CotizacionServicio[]; canEdit: boolean; }

export default function CotizacionesClient({ cotizaciones: init, canEdit }: Props) {
  const [cotizaciones, setCotizaciones] = useState(init);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [nit, setNit] = useState("");
  const [nombre, setNombre] = useState("");
  const [servicio, setServicio] = useState("");
  const [costo, setCosto] = useState("");
  const [exentoIva, setExentoIva] = useState(false);

  function openModal() {
    setFecha(new Date().toISOString().slice(0, 10));
    setNit(""); setNombre(""); setServicio(""); setCosto(""); setExentoIva(false);
    setError(""); setModal(true);
  }

  async function handleGuardar() {
    const costoNum = parseFloat(costo);
    if (!nombre.trim() || !servicio.trim()) return setError("Proveedor y servicio son obligatorios");
    if (!(costoNum > 0)) return setError("Ingresa un costo válido");
    setSaving(true); setError("");
    const res = await crearCotizacionServicio({
      fecha, proveedor_id: null, proveedor_nit: nit.trim() || null,
      proveedor_nombre: nombre.trim(), servicio: servicio.trim(),
      costo: costoNum, exento_iva: exentoIva,
    });
    setSaving(false);
    if ("error" in res) return setError(res.error);
    setCotizaciones(p => [{
      id: Date.now(), fecha, proveedor_id: null, proveedor_nit: nit.trim() || null,
      proveedor_nombre: nombre.trim(), servicio: servicio.trim(),
      costo: costoNum, exento_iva: exentoIva, usado: false,
    }, ...p]);
    setModal(false);
  }

  async function handleEliminar(id: number) {
    if (!confirm("¿Eliminar esta cotización?")) return;
    setRemovingId(id);
    const res = await eliminarCotizacionServicio(id);
    setRemovingId(null);
    if ("error" in res) { alert(res.error); return; }
    setCotizaciones(p => p.filter(c => c.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Cotizaciones de Servicio
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Registra cotizaciones de servicio recibidas con antelación para usarlas en Baja Cuantía.
          </p>
        </div>
        {canEdit && (
          <button onClick={openModal} className="btn-primary">
            <Plus className="w-4 h-4" /> Nueva cotización
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-left">Servicio</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Costo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                {canEdit && <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cotizaciones.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.fecha}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.proveedor_nombre}</p>
                    {c.proveedor_nit && <p className="text-xs text-gray-400">NIT: {c.proveedor_nit}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.servicio}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">{Q(c.costo)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.usado ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                        <CheckCircle2 className="w-3 h-3" /> Usada
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Disponible</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      {!c.usado && (
                        <button onClick={() => handleEliminar(c.id)} disabled={removingId === c.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          {removingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {cotizaciones.length === 0 && (
            <div className="text-center py-12 text-gray-400">No hay cotizaciones registradas</div>
          )}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Nueva cotización de servicio</h2>
              <button onClick={() => setModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="label">Fecha</label>
                <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
              <div>
                <label className="label">NIT del proveedor</label>
                <input className="input font-mono" value={nit} onChange={e => setNit(e.target.value)} />
              </div>
              <div>
                <label className="label">Nombre del proveedor</label>
                <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} />
              </div>
              <div>
                <label className="label">Servicio cotizado</label>
                <input className="input" value={servicio} onChange={e => setServicio(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <label className="label">Costo</label>
                  <input type="number" step="0.01" min="0.01" className="input" value={costo} onChange={e => setCosto(e.target.value)} />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap mt-6">
                  <input type="checkbox" checked={exentoIva} onChange={e => setExentoIva(e.target.checked)} className="w-3.5 h-3.5 accent-brand-600" />
                  Exento IVA
                </label>
              </div>
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleGuardar} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
