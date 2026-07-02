"use client";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Q } from "./ConsolidacionesTable";
import NitAutocomplete from "./NitAutocomplete";
import type { Oferente } from "@/lib/adjudicacion/types";

interface Props {
  oferentes: Oferente[];
  maxOferentes: number;
  // Modo edición (Compras): permite agregar/quitar
  editable?: boolean;
  onAdd?: (data: { proveedor_id: number | null; nit: string; nombre: string; costo: number; exento_iva: boolean }) => Promise<void>;
  onRemove?: (id: number) => Promise<void>;
  // Modo selección (Junta): radio para elegir ganador
  selectable?: boolean;
  selectedId?: number | null;
  onSelect?: (id: number) => void;
}

export default function OferentesEditor({
  oferentes, maxOferentes, editable, onAdd, onRemove, selectable, selectedId, onSelect,
}: Props) {
  const [nit, setNit] = useState("");
  const [nombre, setNombre] = useState("");
  const [costo, setCosto] = useState("");
  const [exentoIva, setExentoIva] = useState(false);
  const [proveedorId, setProveedorId] = useState<number | null>(null);
  const [encontrado, setEncontrado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  function handleSelectProveedor(p: { id: number; nit: string | null; nombre: string }) {
    setNit(p.nit ?? nit);
    setNombre(p.nombre);
    setProveedorId(p.id);
    setEncontrado(true);
  }

  function resetForm() {
    setNit(""); setNombre(""); setCosto(""); setExentoIva(false);
    setProveedorId(null); setEncontrado(false); setError("");
  }

  async function handleAgregar() {
    if (!onAdd) return;
    if (!nit.trim() || !nombre.trim()) { setError("NIT y nombre son obligatorios"); return; }
    const costoNum = parseFloat(costo);
    if (!(costoNum > 0)) { setError("Ingresa un costo válido"); return; }
    setSaving(true); setError("");
    await onAdd({ proveedor_id: proveedorId, nit: nit.trim(), nombre: nombre.trim(), costo: costoNum, exento_iva: exentoIva });
    setSaving(false);
    resetForm();
  }

  async function handleQuitar(id: number) {
    if (!onRemove) return;
    setRemovingId(id);
    await onRemove(id);
    setRemovingId(null);
  }

  return (
    <div className="space-y-3">
      {oferentes.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {oferentes.map(o => (
            <div key={o.id}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 ${selectedId === o.id ? "bg-brand-50" : "bg-white"}`}>
              {selectable && (
                <input type="radio" name="oferente-ganador" checked={selectedId === o.id}
                  onChange={() => onSelect?.(o.id)} className="w-4 h-4 accent-brand-600 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{o.nombre}</p>
                <p className="text-xs text-gray-400 font-mono">NIT: {o.nit}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-gray-900">{Q(o.costo)}</p>
                <p className="text-[10px] text-gray-400">{o.exento_iva ? "Exento IVA" : "Con IVA (12%)"}</p>
              </div>
              {editable && onRemove && (
                <button onClick={() => handleQuitar(o.id)} disabled={removingId === o.id}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                  {removingId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editable && onAdd && oferentes.length < maxOferentes && (
        <div className="border border-dashed border-gray-300 rounded-xl p-3 space-y-2.5 bg-gray-50/60">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Agregar oferente ({oferentes.length}/{maxOferentes})
          </p>
          <NitAutocomplete
            value={nit}
            onChange={v => { setNit(v); setEncontrado(false); setProveedorId(null); }}
            onSelect={handleSelectProveedor}
            placeholder="NIT o nombre del oferente…"
          />
          {encontrado && <p className="text-xs text-green-700">✓ Proveedor encontrado en catálogo</p>}
          <input className="input text-sm" placeholder="Nombre del oferente"
            value={nombre} onChange={e => setNombre(e.target.value)} />
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">Q</span>
              <input type="number" step="0.01" min="0.01" className="input pl-6 text-sm" placeholder="Costo ofertado"
                value={costo} onChange={e => setCosto(e.target.value)} />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap shrink-0">
              <input type="checkbox" checked={exentoIva} onChange={e => setExentoIva(e.target.checked)} className="w-3.5 h-3.5 accent-brand-600" />
              Exento IVA
            </label>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="button" onClick={handleAgregar} disabled={saving}
            className="btn-primary w-full justify-center text-sm disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar oferente
          </button>
        </div>
      )}

      {oferentes.length === 0 && !editable && (
        <p className="text-sm text-gray-400">Sin oferentes registrados.</p>
      )}
    </div>
  );
}
