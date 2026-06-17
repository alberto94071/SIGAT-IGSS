"use client";
import { useState, useMemo } from "react";
import {
  Package, Plus, Pencil, Trash2, Search, X, ChevronDown
} from "lucide-react";
import { crearServicio, editarServicio, eliminarServicio } from "./actions";

type Servicio = {
  id: number; siaf_numero: number | null; fecha: string;
  cuatrimestre: "PRIMERO"|"SEGUNDO"|"TERCERO"|null;
  renglon: number | null; codigo_igss: number | null;
  insumo: string | null; cantidad: number | null;
  subproducto: string | null; precio_registrado: number | null;
  fecha_compra: string | null; numero_compra: string | null;
  numero_documento: string | null; estado_oc: string | null;
};
type InsumoRef = {
  codigo_igss: number; nombre: string;
  subproducto: string | null; unidad_medida: string | null;
};

const EMPTY = {
  siaf_numero: "", fecha: new Date().toISOString().slice(0,10),
  cuatrimestre: "PRIMERO" as "PRIMERO"|"SEGUNDO"|"TERCERO", renglon: "266",
  codigo_igss: "", insumo: "", cantidad: "", subproducto: "",
  precio_registrado: "", fecha_compra: "", numero_compra: "",
  numero_documento: "", estado_oc: "Recibido",
};

interface Props {
  servicios: Servicio[]; catalogo: InsumoRef[];
  canEdit: boolean; userId: number;
}

export default function ServiciosClient({ servicios: init, catalogo, canEdit }: Props) {
  const [lista,     setLista]     = useState(init);
  const [query,     setQuery]     = useState("");
  const [modal,     setModal]     = useState<"crear"|"editar"|null>(null);
  const [selected,  setSelected]  = useState<Servicio|null>(null);
  const [form,      setForm]      = useState(EMPTY);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  // autocomplete insumo
  const [insumoQ,   setInsumoQ]   = useState("");
  const [showDrop,  setShowDrop]  = useState(false);

  const filtered = useMemo(() =>
    lista.filter(s =>
      !query ||
      String(s.siaf_numero).includes(query) ||
      (s.insumo ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (s.subproducto ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (s.numero_compra ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (s.numero_documento ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (s.cuatrimestre ?? "").toLowerCase().includes(query.toLowerCase()) ||
      String(s.codigo_igss).includes(query) ||
      String(s.renglon).includes(query)
    ), [lista, query]);

  const insumoSuggestions = useMemo(() =>
    !insumoQ ? [] : catalogo
      .filter(c =>
        c.nombre.toLowerCase().includes(insumoQ.toLowerCase()) ||
        String(c.codigo_igss).includes(insumoQ)
      ).slice(0, 8),
    [insumoQ, catalogo]);

  function set(k: string, v: string) {
    setForm(p => ({ ...p, [k]: v }));
  }

  function pickInsumo(ins: InsumoRef) {
    setForm(p => ({
      ...p,
      codigo_igss:  String(ins.codigo_igss),
      insumo:       ins.nombre,
      subproducto:  ins.subproducto ?? "",
    }));
    setInsumoQ(ins.nombre);
    setShowDrop(false);
  }

  function openCrear() {
    setForm(EMPTY); setInsumoQ(""); setError("");
    setModal("crear");
  }

  function openEditar(s: Servicio) {
    setSelected(s);
    setForm({
      siaf_numero:       String(s.siaf_numero ?? ""),
      fecha:             s.fecha,
      cuatrimestre:      s.cuatrimestre ?? "PRIMERO",
      renglon:           String(s.renglon ?? "266"),
      codigo_igss:       String(s.codigo_igss ?? ""),
      insumo:            s.insumo ?? "",
      cantidad:          s.cantidad?.toString() ?? "",
      subproducto:       s.subproducto ?? "",
      precio_registrado: s.precio_registrado?.toString() ?? "",
      fecha_compra:      s.fecha_compra ?? "",
      numero_compra:     s.numero_compra ?? "",
      numero_documento:  s.numero_documento ?? "",
      estado_oc:         s.estado_oc ?? "Recibido",
    });
    setInsumoQ(s.insumo ?? "");
    setError("");
    setModal("editar");
  }

  async function handleCrear() {
    if (!form.fecha || !form.insumo) return setError("Fecha e insumo son obligatorios");
    setLoading(true);
    const res = await crearServicio(form);
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(p => [res.servicio!, ...p] as unknown as Servicio[]);
    setModal(null);
  }

  async function handleEditar() {
    if (!selected) return;
    setLoading(true);
    const res = await editarServicio({ id: selected.id, ...form });
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(p => p.map(s => s.id === selected.id
      ? { ...s, ...form,
          cuatrimestre: form.cuatrimestre as "PRIMERO"|"SEGUNDO"|"TERCERO"|null,
          cantidad: form.cantidad ? parseFloat(form.cantidad) : null,
          precio_registrado: form.precio_registrado ? parseFloat(form.precio_registrado) : null
        }
      : s) as unknown as Servicio[]);
    setModal(null);
  }

  async function handleEliminar(id: number) {
    if (!confirm("¿Eliminar este registro?")) return;
    await eliminarServicio(id);
    setLista(p => p.filter(s => s.id !== id));
  }

  const fmt = (n: number|null, qty: number|null) => {
    if (!n || !qty) return "—";
    return `Q ${(n * qty).toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5" /> Servicios / Ingresos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} registros</p>
        </div>
        {canEdit && (
          <button onClick={openCrear} className="btn-primary">
            <Plus className="w-4 h-4" /> Nuevo ingreso
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar SIAF, insumo, OC…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">No. / SIAF</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Cuatrimestre</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Renglón</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Código IGSS</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Insumo</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Cantidad</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Subproducto</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">P. Unit.</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">F. Compra</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">OC</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Documento</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                {canEdit && <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{s.siaf_numero ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{s.fecha}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{s.cuatrimestre ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{s.renglon ?? "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">{s.codigo_igss ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-medium text-gray-900 max-w-[220px] truncate" title={s.insumo ?? ""}>{s.insumo ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 whitespace-nowrap">
                    {s.cantidad != null ? s.cantidad.toLocaleString("es-GT") : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap max-w-[150px] truncate" title={s.subproducto ?? ""}>
                    {s.subproducto ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 whitespace-nowrap">
                    {s.precio_registrado != null ? `Q ${s.precio_registrado.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900 whitespace-nowrap">
                    {fmt(s.precio_registrado, s.cantidad)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{s.fecha_compra ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{s.numero_compra ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{s.numero_documento ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.estado_oc === "Recibido" ? "bg-green-100 text-green-700" :
                      s.estado_oc === "Pendiente" ? "bg-yellow-100 text-yellow-700" :
                      s.estado_oc === "Anulado" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {s.estado_oc ?? "—"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEditar(s)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleEliminar(s.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">No hay registros</div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-900">
                {modal === "crear" ? "Nuevo ingreso de servicio" : "Editar ingreso"}
              </h2>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* SIAF auto */}
              <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg text-sm">
                <span className="font-medium text-brand-700">SIAF #</span>
                <span className="font-bold text-brand-800">Auto-generado</span>
                <span className="text-brand-500 text-xs ml-1">(se asigna al guardar, sin duplicados)</span>
              </div>

              {/* Fila 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha *</label>
                  <input className="input" type="date" value={form.fecha}
                    onChange={e => set("fecha", e.target.value)} />
                </div>
                <div>
                  <label className="label">Cuatrimestre</label>
                  <select className="input" value={form.cuatrimestre}
                    onChange={e => set("cuatrimestre", e.target.value)}>
                    <option>PRIMERO</option>
                    <option>SEGUNDO</option>
                    <option>TERCERO</option>
                  </select>
                </div>
              </div>

              {/* Insumo autocomplete */}
              <div className="relative">
                <label className="label">Insumo *</label>
                <div className="relative">
                  <input className="input pr-8" value={insumoQ}
                    onChange={e => { setInsumoQ(e.target.value); set("insumo", e.target.value); setShowDrop(true); }}
                    onFocus={() => setShowDrop(true)}
                    placeholder="Buscar por nombre o código IGSS…" />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                {showDrop && insumoSuggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {insumoSuggestions.map(ins => (
                      <button key={ins.codigo_igss} type="button"
                        onMouseDown={() => pickInsumo(ins)}
                        className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors border-b border-gray-50 last:border-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{ins.nombre}</p>
                        <p className="text-xs text-gray-400">
                          Cód. {ins.codigo_igss} · {ins.subproducto} · {ins.unidad_medida}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fila 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Renglón</label>
                  <input className="input" type="number" value={form.renglon}
                    onChange={e => set("renglon", e.target.value)} />
                </div>
                <div>
                  <label className="label">Cantidad</label>
                  <input className="input" type="number" step="0.01" value={form.cantidad}
                    onChange={e => set("cantidad", e.target.value)} />
                </div>
                <div>
                  <label className="label">Precio unitario (Q)</label>
                  <input className="input" type="number" step="0.0001" value={form.precio_registrado}
                    onChange={e => set("precio_registrado", e.target.value)} />
                </div>
              </div>

              {/* Total calculado */}
              {form.cantidad && form.precio_registrado && (
                <div className="bg-brand-50 border border-brand-200 rounded-lg px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-brand-700 font-medium">Total calculado</span>
                  <span className="text-lg font-bold text-brand-800">
                    Q {(parseFloat(form.cantidad||"0") * parseFloat(form.precio_registrado||"0")).toLocaleString("es-GT", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Fila 4 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha de compra</label>
                  <input className="input" type="date" value={form.fecha_compra}
                    onChange={e => set("fecha_compra", e.target.value)} />
                </div>
                <div>
                  <label className="label">N° Orden de Compra</label>
                  <input className="input" value={form.numero_compra}
                    onChange={e => set("numero_compra", e.target.value)} placeholder="OC-2026-001" />
                </div>
              </div>

              {/* Fila 5 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">N° Documento</label>
                  <input className="input" value={form.numero_documento}
                    onChange={e => set("numero_documento", e.target.value)} />
                </div>
                <div>
                  <label className="label">Estado OC</label>
                  <select className="input" value={form.estado_oc}
                    onChange={e => set("estado_oc", e.target.value)}>
                    <option>Recibido</option>
                    <option>Pendiente</option>
                    <option>Parcial</option>
                    <option>Anulado</option>
                  </select>
                </div>
              </div>
            </div>

            {error && (
              <div className="mx-5 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
              <button onClick={modal === "crear" ? handleCrear : handleEditar}
                disabled={loading} className="btn-primary">
                {loading ? "Guardando…" : (modal === "crear" ? "Registrar ingreso" : "Guardar cambios")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
