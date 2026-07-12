"use client";
import { Fragment, useState } from "react";
import { FileSignature, Plus, X, Loader2, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { crearCotizacionAnual, eliminarCotizacionAnual } from "@/lib/adjudicacion/cotizaciones-actions";
import { LineasCotizacionAnual } from "../cotizaciones/CotizacionesClient";
import NitAutocomplete from "@/components/adjudicacion/NitAutocomplete";
import type { CotizacionAnual } from "@/lib/adjudicacion/types";

interface Props { contratos: CotizacionAnual[]; canEdit: boolean; }

// Cotizaciones de Contrato Abierto — mismo patrón que Cotizaciones Anuales
// (cabecera con proveedor + líneas de insumo con precio pactado), solo que
// filtradas a tipo="contrato_abierto".
export default function ContratoAbiertoClient({ contratos: init, canEdit }: Props) {
  const [contratos, setContratos] = useState(init);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [numero, setNumero] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [nit, setNit] = useState("");
  const [nombre, setNombre] = useState("");
  const [proveedorId, setProveedorId] = useState<number | null>(null);

  function openModal() {
    setNumero(""); setAnio(new Date().getFullYear());
    setFecha(new Date().toISOString().slice(0, 10));
    setNit(""); setNombre(""); setProveedorId(null);
    setError(""); setModal(true);
  }

  async function handleGuardar() {
    if (!nombre.trim()) return setError("El proveedor es obligatorio");
    if (!numero.trim()) return setError("El número de contrato es obligatorio");
    setSaving(true); setError("");
    const res = await crearCotizacionAnual({
      numero: numero.trim(), anio, tipo: "contrato_abierto", proveedor_id: proveedorId,
      proveedor_nit: nit.trim() || null, proveedor_nombre: nombre.trim(), fecha,
    });
    setSaving(false);
    if ("error" in res) return setError(res.error);
    setContratos(p => [{
      id: res.id, numero: numero.trim(), anio, tipo: "contrato_abierto",
      proveedor_id: proveedorId, proveedor_nit: nit.trim() || null,
      proveedor_nombre: nombre.trim(), fecha, items: [],
    }, ...p]);
    setModal(false);
  }

  async function handleEliminar(id: number) {
    if (!confirm("¿Eliminar este contrato abierto y todas sus líneas de precio?")) return;
    setRemovingId(id);
    const res = await eliminarCotizacionAnual(id);
    setRemovingId(null);
    if ("error" in res) { alert(res.error); return; }
    setContratos(p => p.filter(c => c.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileSignature className="w-5 h-5" /> Contrato Abierto
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Contratos abiertos vigentes con proveedores — varios insumos con precio ya pactado.
          </p>
        </div>
        {canEdit && (
          <button onClick={openModal} className="btn-primary">
            <Plus className="w-4 h-4" /> Nuevo contrato abierto
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Contrato</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Año</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Insumos</th>
                {canEdit && <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contratos.map(c => {
                const expanded = expandedId === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(p => p === c.id ? null : c.id)}>
                      <td className="px-4 py-3 text-gray-400">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{c.numero}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{c.proveedor_nombre}</p>
                        {c.proveedor_nit && <p className="text-xs text-gray-400">NIT: {c.proveedor_nit}</p>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{c.anio}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                          {c.items.length}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleEliminar(c.id)} disabled={removingId === c.id}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            {removingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      )}
                    </tr>
                    {expanded && (
                      <tr className="bg-amber-50/40">
                        <td colSpan={canEdit ? 6 : 5} className="px-6 py-4">
                          <LineasCotizacionAnual cotizacion={c} canEdit={canEdit}
                            onChange={items => setContratos(p => p.map(x => x.id === c.id ? { ...x, items } : x))} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {contratos.length === 0 && (
            <div className="text-center py-12 text-gray-400">No hay contratos abiertos registrados</div>
          )}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Nuevo contrato abierto</h2>
              <button onClick={() => setModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Número de contrato</label>
                  <input className="input font-mono" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ej. CA-01/2026" />
                </div>
                <div>
                  <label className="label">Año</label>
                  <input type="number" className="input" value={anio} onChange={e => setAnio(parseInt(e.target.value) || anio)} />
                </div>
              </div>
              <div>
                <label className="label">Fecha del acuerdo</label>
                <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
              <div>
                <label className="label">Proveedor</label>
                <NitAutocomplete
                  value={nit}
                  onChange={v => { setNit(v); setProveedorId(null); }}
                  onSelect={p => { setNit(p.nit ?? nit); setNombre(p.nombre); setProveedorId(p.id); }}
                />
              </div>
              <div>
                <label className="label">Nombre del proveedor</label>
                <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} />
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
