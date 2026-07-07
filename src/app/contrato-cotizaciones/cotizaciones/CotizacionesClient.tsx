"use client";
import { Fragment, useState } from "react";
import { FileText, Plus, X, Loader2, Trash2, CheckCircle2, Layers, ChevronDown, ChevronRight, Search } from "lucide-react";
import {
  crearCotizacionServicio, eliminarCotizacionServicio,
  crearCotizacionAnual, eliminarCotizacionAnual,
  agregarLineaCotizacionAnual, eliminarLineaCotizacionAnual, buscarInsumoCatalogo,
} from "@/lib/adjudicacion/cotizaciones-actions";
import { Q } from "@/components/adjudicacion/ConsolidacionesTable";
import NitAutocomplete from "@/components/adjudicacion/NitAutocomplete";
import type { CotizacionServicio, CotizacionAnual } from "@/lib/adjudicacion/types";

interface Props {
  cotizaciones: CotizacionServicio[];
  cotizacionesAnuales: CotizacionAnual[];
  canEdit: boolean;
}

export default function CotizacionesClient({ cotizaciones, cotizacionesAnuales, canEdit }: Props) {
  const [tab, setTab] = useState<"servicio" | "anual">("anual");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5" /> Cotizaciones
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Cotizaciones pactadas con proveedores para respaldar compras de Baja Cuantía.
        </p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button onClick={() => setTab("anual")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === "anual" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Cotizaciones Anuales (por insumo)
        </button>
        <button onClick={() => setTab("servicio")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === "servicio" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Cotizaciones de Servicio
        </button>
      </div>

      {tab === "anual"
        ? <CotizacionesAnualesTab cotizaciones={cotizacionesAnuales} canEdit={canEdit} />
        : <CotizacionesServicioTab cotizaciones={cotizaciones} canEdit={canEdit} />}
    </div>
  );
}

// ─── Tab: Cotizaciones de Servicio (existente) ───────────────────────────────

function CotizacionesServicioTab({ cotizaciones: init, canEdit }: { cotizaciones: CotizacionServicio[]; canEdit: boolean }) {
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
    <div className="space-y-4">
      <div className="flex justify-end">
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

// ─── Tab: Cotizaciones Anuales (por proveedor, varios insumos con precio) ────

function CotizacionesAnualesTab({ cotizaciones: init, canEdit }: { cotizaciones: CotizacionAnual[]; canEdit: boolean }) {
  const [cotizaciones, setCotizaciones] = useState(init);
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
    if (!numero.trim()) return setError("El número de cotización es obligatorio");
    setSaving(true); setError("");
    const res = await crearCotizacionAnual({
      numero: numero.trim(), anio, proveedor_id: proveedorId,
      proveedor_nit: nit.trim() || null, proveedor_nombre: nombre.trim(), fecha,
    });
    setSaving(false);
    if ("error" in res) return setError(res.error);
    setCotizaciones(p => [{
      id: res.id, numero: numero.trim(), anio,
      proveedor_id: proveedorId, proveedor_nit: nit.trim() || null,
      proveedor_nombre: nombre.trim(), fecha, items: [],
    }, ...p]);
    setModal(false);
  }

  async function handleEliminar(id: number) {
    if (!confirm("¿Eliminar esta cotización anual y todas sus líneas de precio?")) return;
    setRemovingId(id);
    const res = await eliminarCotizacionAnual(id);
    setRemovingId(null);
    if ("error" in res) { alert(res.error); return; }
    setCotizaciones(p => p.filter(c => c.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canEdit && (
          <button onClick={openModal} className="btn-primary">
            <Plus className="w-4 h-4" /> Nueva cotización anual
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Número</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Año</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Insumos</th>
                {canEdit && <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cotizaciones.map(c => {
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
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
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
                      <tr className="bg-brand-50/40">
                        <td colSpan={canEdit ? 6 : 5} className="px-6 py-4">
                          <LineasCotizacionAnual cotizacion={c} canEdit={canEdit}
                            onChange={items => setCotizaciones(p => p.map(x => x.id === c.id ? { ...x, items } : x))} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {cotizaciones.length === 0 && (
            <div className="text-center py-12 text-gray-400">No hay cotizaciones anuales registradas</div>
          )}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Nueva cotización anual</h2>
              <button onClick={() => setModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Número de cotización</label>
                  <input className="input font-mono" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ej. COT-03/2026" />
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

// ─── Líneas de precio (insumo → precio) de una cotización anual ──────────────

function LineasCotizacionAnual({ cotizacion, canEdit, onChange }: {
  cotizacion: CotizacionAnual; canEdit: boolean;
  onChange: (items: CotizacionAnual["items"]) => void;
}) {
  const [addingLine, setAddingLine] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [codigo, setCodigo] = useState("");
  const [precio, setPrecio] = useState("");
  const [exento, setExento] = useState(false);
  const [insumoQuery, setInsumoQuery] = useState("");
  const [insumoResults, setInsumoResults] = useState<{ codigo_igss: string | null; nombre: string; unidad_medida: string | null }[]>([]);
  const [insumoLoading, setInsumoLoading] = useState(false);
  const [insumoOpen, setInsumoOpen] = useState(false);

  async function buscarInsumo(q: string) {
    setInsumoQuery(q); setInsumoOpen(true);
    if (q.trim().length < 2) { setInsumoResults([]); return; }
    setInsumoLoading(true);
    const r = await buscarInsumoCatalogo(q);
    setInsumoLoading(false);
    setInsumoResults(r);
  }

  async function handleAgregar() {
    const precioNum = parseFloat(precio);
    if (!codigo.trim()) return setError("Selecciona un insumo");
    if (!(precioNum > 0)) return setError("Ingresa un precio unitario válido");
    setSaving(true); setError("");
    const res = await agregarLineaCotizacionAnual(cotizacion.id, {
      codigo_igss: codigo.trim(), precio_unitario: precioNum, exento_iva: exento,
    });
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onChange([...cotizacion.items, {
      id: Date.now(), cotizacion_anual_id: cotizacion.id,
      codigo_igss: codigo.trim(), precio_unitario: precioNum, exento_iva: exento,
    }]);
    setCodigo(""); setPrecio(""); setExento(false); setInsumoQuery(""); setAddingLine(false);
  }

  async function handleEliminarLinea(id: number) {
    setRemovingId(id);
    const res = await eliminarLineaCotizacionAnual(id);
    setRemovingId(null);
    if ("error" in res) { alert(res.error); return; }
    onChange(cotizacion.items.filter(i => i.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Precios pactados — {cotizacion.numero}
        </p>
        {canEdit && !addingLine && (
          <button onClick={() => setAddingLine(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100">
            <Plus className="w-3.5 h-3.5" /> Agregar insumo
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Código</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">Precio unitario</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-600 whitespace-nowrap">Exento IVA</th>
              {canEdit && <th className="px-3 py-2 w-8"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {cotizacion.items.map(item => (
              <tr key={item.id}>
                <td className="px-3 py-2 font-mono text-gray-900">{item.codigo_igss}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">{Q(item.precio_unitario)}</td>
                <td className="px-3 py-2 text-center">{item.exento_iva ? "Sí" : "No"}</td>
                {canEdit && (
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => handleEliminarLinea(item.id)} disabled={removingId === item.id}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      {removingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {cotizacion.items.length === 0 && !addingLine && (
              <tr><td colSpan={canEdit ? 4 : 3} className="px-3 py-4 text-center text-gray-400">Sin insumos con precio todavía</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {addingLine && (
        <div className="border border-gray-200 rounded-xl p-3 space-y-2 bg-white">
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                className="input pl-8 text-sm"
                placeholder="Buscar insumo por nombre o código IGSS…"
                value={insumoQuery}
                onChange={e => buscarInsumo(e.target.value)}
                onFocus={() => setInsumoOpen(true)}
              />
            </div>
            {insumoOpen && insumoQuery.trim().length >= 2 && (insumoLoading || insumoResults.length > 0) && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {insumoLoading && <p className="px-3 py-2 text-xs text-gray-400">Buscando…</p>}
                {!insumoLoading && insumoResults.length === 0 && (
                  <p className="px-3 py-2 text-xs text-gray-400">Sin coincidencias.</p>
                )}
                {insumoResults.map((r, i) => (
                  <button key={i} type="button"
                    onMouseDown={() => { setCodigo(r.codigo_igss ?? ""); setInsumoQuery(`${r.codigo_igss ?? ""} — ${r.nombre}`); setInsumoOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-brand-50 border-b border-gray-50 last:border-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.nombre}</p>
                    <p className="text-xs text-gray-400 font-mono">{r.codigo_igss ?? "sin código"}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <label className="label">Precio unitario</label>
              <input type="number" step="0.01" min="0.01" className="input" value={precio} onChange={e => setPrecio(e.target.value)} />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap mt-6">
              <input type="checkbox" checked={exento} onChange={e => setExento(e.target.checked)} className="w-3.5 h-3.5 accent-brand-600" />
              Exento IVA
            </label>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setAddingLine(false); setError(""); }} className="btn-secondary text-xs">Cancelar</button>
            <button onClick={handleAgregar} disabled={saving} className="btn-primary text-xs disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />} Guardar precio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
