"use client";
import { useState, useMemo, Fragment } from "react";
import Link from "next/link";
import {
  Database, Search, Plus, ChevronLeft, ChevronDown, ChevronRight,
  X, Loader2, CheckCircle2, Trash2,
} from "lucide-react";
import { crearRegistroBD, eliminarRegistroBD } from "./actions";

type Registro = {
  id: number;
  codigo_siges: string | null;
  codigo_formulacion: number | null;
  subproducto: string | null;
  codigo_ppr: number | null;
  nombre: string;
  caracteristicas: string | null;
  presentacion: string | null;
  renglon: number | null;
  precio_unitario: number | null;
  cantidad_2027: number | null; monto_2027: number | null;
  cantidad_2028: number | null; monto_2028: number | null;
  cantidad_2029: number | null; monto_2029: number | null;
  cantidad_2030: number | null; monto_2030: number | null;
  cantidad_2031: number | null; monto_2031: number | null;
  activo: boolean;
};

const YEARS = [2027, 2028, 2029, 2030, 2031] as const;
const Q = (fmt: number | null) =>
  fmt != null ? fmt.toLocaleString("es-GT", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "—";

interface Props { registros: Registro[] }

export default function BaseDatosClient({ registros: initReg }: Props) {
  const [registros, setRegistros] = useState(initReg);
  const [query,       setQuery]       = useState("");
  const [filtroSiges, setFiltroSiges] = useState("");
  const [filtroRenglon, setFiltroRenglon] = useState("");
  const [expandedId,  setExpandedId]  = useState<number | null>(null);

  // Modal
  const [modal,   setModal]   = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [mError,  setMError]  = useState("");
  const [form, setForm] = useState({
    codigo_siges: "", codigo_formulacion: "", subproducto: "",
    codigo_ppr: "", nombre: "", caracteristicas: "", presentacion: "",
    renglon: "", precio_unitario: "",
    cantidad_2027: "", monto_2027: "",
    cantidad_2028: "", monto_2028: "",
    cantidad_2029: "", monto_2029: "",
    cantidad_2030: "", monto_2030: "",
    cantidad_2031: "", monto_2031: "",
  });

  // ─── Opciones únicas para filtros ─────────────────────────────────────────
  const sigesOptions = useMemo(() => {
    const s = new Set(registros.map(r => r.codigo_siges).filter(Boolean) as string[]);
    return [...s].sort();
  }, [registros]);

  const renglonOptions = useMemo(() => {
    const s = new Set(registros.map(r => r.renglon).filter(Boolean) as number[]);
    return [...s].sort((a, b) => a - b);
  }, [registros]);

  // ─── Filtro en tiempo real ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return registros.filter(r => {
      if (filtroSiges && r.codigo_siges !== filtroSiges) return false;
      if (filtroRenglon && String(r.renglon) !== filtroRenglon) return false;
      if (!q) return true;
      return (
        r.nombre.toLowerCase().includes(q) ||
        (r.caracteristicas ?? "").toLowerCase().includes(q) ||
        (r.presentacion ?? "").toLowerCase().includes(q) ||
        String(r.codigo_ppr ?? "").includes(q) ||
        (r.subproducto ?? "").toLowerCase().includes(q)
      );
    });
  }, [registros, query, filtroSiges, filtroRenglon]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  function openModal() {
    setForm({
      codigo_siges: "", codigo_formulacion: "", subproducto: "",
      codigo_ppr: "", nombre: "", caracteristicas: "", presentacion: "",
      renglon: "", precio_unitario: "",
      cantidad_2027: "", monto_2027: "",
      cantidad_2028: "", monto_2028: "",
      cantidad_2029: "", monto_2029: "",
      cantidad_2030: "", monto_2030: "",
      cantidad_2031: "", monto_2031: "",
    });
    setMError("");
    setModal(true);
  }

  async function handleGuardar() {
    if (!form.nombre.trim()) return setMError("El nombre es obligatorio.");
    setSaving(true);
    const n = (v: string) => v.trim() === "" ? null : Number(v);
    const res = await crearRegistroBD({
      codigo_siges:       form.codigo_siges.trim() || null,
      codigo_formulacion: n(form.codigo_formulacion),
      subproducto:        form.subproducto.trim() || null,
      codigo_ppr:         n(form.codigo_ppr),
      nombre:             form.nombre.trim(),
      caracteristicas:    form.caracteristicas.trim() || null,
      presentacion:       form.presentacion.trim() || null,
      renglon:            n(form.renglon),
      precio_unitario:    n(form.precio_unitario),
      cantidad_2027: n(form.cantidad_2027), monto_2027: n(form.monto_2027),
      cantidad_2028: n(form.cantidad_2028), monto_2028: n(form.monto_2028),
      cantidad_2029: n(form.cantidad_2029), monto_2029: n(form.monto_2029),
      cantidad_2030: n(form.cantidad_2030), monto_2030: n(form.monto_2030),
      cantidad_2031: n(form.cantidad_2031), monto_2031: n(form.monto_2031),
    });
    setSaving(false);
    if (res.error) return setMError(res.error);
    setRegistros(p => [res.registro as Registro, ...p]);
    setModal(false);
  }

  async function handleEliminar(id: number) {
    if (!confirm("¿Eliminar este registro de la base de datos?")) return;
    await eliminarRegistroBD(id);
    setRegistros(p => p.filter(r => r.id !== id));
  }

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-gradient-to-r from-blue-800 to-blue-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center ring-2 ring-white/30">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none">Base de Datos Central</h1>
              <p className="text-blue-200 text-xs mt-0.5">Catálogo SIGES — Proyecciones 2027–2031</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openModal}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-50 transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Agregar registro
            </button>
            <Link href="/launcher"
              className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/20 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Menú principal
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">

        {/* Buscador + filtros */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Buscar por nombre, característica, PPR, subproducto…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <select className="input w-auto min-w-[160px]"
            value={filtroSiges} onChange={e => setFiltroSiges(e.target.value)}>
            <option value="">— Todos los programas —</option>
            {sigesOptions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select className="input w-auto min-w-[130px]"
            value={filtroRenglon} onChange={e => setFiltroRenglon(e.target.value)}>
            <option value="">— Todos los renglones —</option>
            {renglonOptions.map(r => (
              <option key={r} value={String(r)}>Renglón {r}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {filtered.length} de {registros.length} registros
          </span>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-3 py-3 w-8"></th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">PPR</th>
                  <th className="px-3 py-3 text-left">Nombre</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">Característica</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">Presentación</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">Renglón</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Precio unit.</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Acc.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const exp = expandedId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setExpandedId(p => p === r.id ? null : r.id)}>
                        <td className="px-3 py-2.5 text-gray-400">
                          {exp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">
                          {r.codigo_ppr ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[220px]">
                          <p className="truncate">{r.nombre}</p>
                          {r.codigo_siges && (
                            <p className="text-xs text-gray-400 font-normal">{r.codigo_siges}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[180px]">
                          <p className="truncate">{r.caracteristicas ?? "—"}</p>
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[160px]">
                          <p className="truncate">{r.presentacion ?? "—"}</p>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {r.renglon ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-800 whitespace-nowrap">
                          Q {Q(r.precio_unitario)}
                        </td>
                        <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleEliminar(r.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>

                      {/* Fila expandida: proyecciones por año */}
                      {exp && (
                        <tr className="bg-blue-50/40">
                          <td colSpan={8} className="px-6 py-4">
                            {r.subproducto && (
                              <p className="text-xs text-gray-500 mb-3 italic line-clamp-2">{r.subproducto}</p>
                            )}
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                              Proyecciones por año
                            </p>
                            <div className="overflow-x-auto">
                              <table className="text-xs w-full max-w-xl">
                                <thead>
                                  <tr className="bg-white border border-gray-200 rounded-xl">
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Año</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Cantidad</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Monto (Q)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white border border-t-0 border-gray-200">
                                  {YEARS.map(yr => {
                                    const q = r[`cantidad_${yr}` as keyof Registro] as number | null;
                                    const m = r[`monto_${yr}` as keyof Registro] as number | null;
                                    return (
                                      <tr key={yr}>
                                        <td className="px-3 py-1.5 font-bold text-blue-700">{yr}</td>
                                        <td className="px-3 py-1.5 text-right tabular-nums">{Q(q)}</td>
                                        <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-green-700">
                                          {m != null ? `Q ${Q(m)}` : "—"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-14 text-gray-400">
                {query || filtroSiges || filtroRenglon
                  ? "No se encontraron registros con esos filtros."
                  : "No hay registros aún. Agrega el primero."}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Modal: Agregar registro ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-900">Agregar registro a la base de datos</h2>
              <button onClick={() => setModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Identificación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Código SIGES</label>
                  <input className="input" placeholder="001-001-0001" value={form.codigo_siges}
                    onChange={e => f("codigo_siges", e.target.value)} />
                </div>
                <div>
                  <label className="label">Código Formulación SIGES</label>
                  <input className="input" type="number" placeholder="13588" value={form.codigo_formulacion}
                    onChange={e => f("codigo_formulacion", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">Subproducto (descripción del programa)</label>
                <textarea className="input resize-none min-h-[56px] text-sm" value={form.subproducto}
                  onChange={e => f("subproducto", e.target.value)}
                  placeholder="Actividades administrativas…" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">PPR (código)</label>
                  <input className="input" type="number" placeholder="1941" value={form.codigo_ppr}
                    onChange={e => f("codigo_ppr", e.target.value)} />
                </div>
                <div>
                  <label className="label">Nombre <span className="text-red-500">*</span></label>
                  <input className="input" placeholder="Combustible" value={form.nombre}
                    onChange={e => f("nombre", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">Característica</label>
                <input className="input" placeholder="Clase: Diésel" value={form.caracteristicas}
                  onChange={e => f("caracteristicas", e.target.value)} />
              </div>

              <div>
                <label className="label">Presentación</label>
                <input className="input" placeholder="2269 - Envase (1 Galón)" value={form.presentacion}
                  onChange={e => f("presentacion", e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Renglón</label>
                  <input className="input" type="number" placeholder="262" value={form.renglon}
                    onChange={e => f("renglon", e.target.value)} />
                </div>
                <div>
                  <label className="label">Precio unitario (Q)</label>
                  <input className="input" type="number" step="0.01" placeholder="32" value={form.precio_unitario}
                    onChange={e => f("precio_unitario", e.target.value)} />
                </div>
              </div>

              {/* Proyecciones por año */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Proyecciones por año</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {YEARS.map(yr => (
                    <div key={yr} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="text-sm font-bold text-blue-700 w-12">{yr}</span>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">Cantidad</label>
                          <input className="input py-1.5 text-sm" type="number" step="0.01" placeholder="0"
                            value={form[`cantidad_${yr}` as keyof typeof form]}
                            onChange={e => f(`cantidad_${yr}` as keyof typeof form, e.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">Monto (Q)</label>
                          <input className="input py-1.5 text-sm" type="number" step="0.01" placeholder="0"
                            value={form[`monto_${yr}` as keyof typeof form]}
                            onChange={e => f(`monto_${yr}` as keyof typeof form, e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {mError && (
              <div className="mx-5 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {mError}
              </div>
            )}

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleGuardar} disabled={saving} className="btn-primary">
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
                  : <><CheckCircle2 className="w-4 h-4" /> Guardar registro</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
