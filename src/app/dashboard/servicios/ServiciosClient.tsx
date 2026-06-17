"use client";
import { useState, useMemo, useEffect } from "react";
import {
  Package, Plus, Pencil, Trash2, Search, X, ChevronDown, CheckCircle2
} from "lucide-react";
import { crearServicio, editarServicio, eliminarServicio, getNextCorrelativo } from "./actions";

type Servicio = {
  id: number; tipo_documento: string; siaf_numero: number | null;
  fecha: string; cuatrimestre: string | null;
  renglon: number | null; codigo_igss: number | null;
  insumo: string | null; cantidad: number | null;
  subproducto: string | null; precio_registrado: number | null;
  fecha_compra: string | null; numero_compra: string | null;
  numero_documento: string | null; estado_oc: string | null;
};
type InsumoRef = {
  codigo_igss: number; nombre: string;
  subproducto: string | null; unidad_medida: string | null;
  precio_unitario: number | null;
};

const TIPOS = ["SIAF", "Vale", "Formulario", "Boleta", "Póliza"] as const;
type TipoDoc = typeof TIPOS[number];

const TIPO_PREFIJO: Record<string, string> = {
  "SIAF": "SIAF", "Vale": "VALE", "Formulario": "FORM",
  "Boleta": "BOL", "Póliza": "POL",
};

const TIPO_COLOR: Record<string, string> = {
  "SIAF": "bg-blue-100 text-blue-700",
  "Vale": "bg-yellow-100 text-yellow-700",
  "Formulario": "bg-green-100 text-green-700",
  "Boleta": "bg-purple-100 text-purple-700",
  "Póliza": "bg-red-100 text-red-700",
};

// Renglones comunes IGSS
const RENGLONES = [
  { r: 261, d: "Elementos y compuestos químicos" },
  { r: 262, d: "Ropa, prendas de vestir y calzado" },
  { r: 263, d: "Material de escritorio y papel" },
  { r: 264, d: "Mat. y suministros médico-quirúrgico" },
  { r: 265, d: "Útiles para clínicas y laboratorios" },
  { r: 266, d: "Productos farmacéuticos y medicinales" },
  { r: 267, d: "Productos de laboratorio" },
  { r: 278, d: "Mat. y suministros para laboratorio" },
  { r: 281, d: "Papel y cartones" },
  { r: 295, d: "Útiles menores de oficina" },
];

const EMPTY = {
  tipo_documento: "SIAF" as TipoDoc,
  fecha: new Date().toISOString().slice(0, 10),
  cuatrimestre: "PRIMERO" as "PRIMERO" | "SEGUNDO" | "TERCERO",
  renglon: "266",
  codigo_igss: "",
  insumo: "",
  cantidad: "",
  precio_registrado: "",
  subproducto: "",
  numero_compra: "",
  numero_documento: "",
  estado_oc: "Recibido",
};

interface Props {
  servicios: Servicio[]; catalogo: InsumoRef[];
  canEdit: boolean; userId: number;
}

export default function ServiciosClient({ servicios: init, catalogo, canEdit }: Props) {
  const [lista,        setLista]        = useState(init);
  const [query,        setQuery]        = useState("");
  const [modal,        setModal]        = useState<"crear" | "editar" | null>(null);
  const [selected,     setSelected]     = useState<Servicio | null>(null);
  const [form,         setForm]         = useState(EMPTY);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [nextCorr,     setNextCorr]     = useState<number>(1);
  const [corrLoading,  setCorrLoading]  = useState(false);

  // Autocomplete states
  const [insumoQ,      setInsumoQ]      = useState("");
  const [showInsumoDrop, setShowInsumoDrop] = useState(false);
  const [renglonQ,     setRenglonQ]     = useState("266");
  const [showRenglonDrop, setShowRenglonDrop] = useState(false);
  const [subprodQ,     setSubprodQ]     = useState("");
  const [showSubprodDrop, setShowSubprodDrop] = useState(false);

  // Listas derivadas del catálogo
  const subproductos = useMemo(() =>
    [...new Set(catalogo.map(c => c.subproducto).filter(Boolean))].sort() as string[],
    [catalogo]
  );

  // Autocomplete insumos
  const insumoSugg = useMemo(() =>
    !insumoQ ? [] : catalogo
      .filter(c =>
        c.nombre.toLowerCase().includes(insumoQ.toLowerCase()) ||
        String(c.codigo_igss).includes(insumoQ)
      ).slice(0, 8),
    [insumoQ, catalogo]
  );

  // Autocomplete renglones
  const renglonSugg = useMemo(() =>
    !renglonQ ? RENGLONES :
    RENGLONES.filter(r =>
      String(r.r).startsWith(renglonQ) ||
      r.d.toLowerCase().includes(renglonQ.toLowerCase())
    ),
    [renglonQ]
  );

  // Autocomplete subproductos
  const subprodSugg = useMemo(() =>
    !subprodQ ? subproductos.slice(0, 8) :
    subproductos.filter(s => s.toLowerCase().includes(subprodQ.toLowerCase())).slice(0, 8),
    [subprodQ, subproductos]
  );

  // Tabla filtrada
  const filtered = useMemo(() =>
    lista.filter(s =>
      !query ||
      String(s.siaf_numero ?? "").includes(query) ||
      (s.insumo ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (s.subproducto ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (s.numero_compra ?? "").includes(query) ||
      (s.tipo_documento ?? "").toLowerCase().includes(query.toLowerCase()) ||
      String(s.renglon ?? "").includes(query)
    ), [lista, query]);

  // Fetch correlativo cuando cambia tipo (solo en modal crear)
  useEffect(() => {
    if (modal !== "crear") return;
    setCorrLoading(true);
    getNextCorrelativo(form.tipo_documento)
      .then(n => { setNextCorr(n); setCorrLoading(false); });
  }, [form.tipo_documento, modal]);

  function set(k: string, v: string) {
    setForm(p => ({ ...p, [k]: v }));
  }

  function pickInsumo(ins: InsumoRef) {
    setForm(p => ({
      ...p,
      codigo_igss:       String(ins.codigo_igss),
      insumo:            ins.nombre,
      subproducto:       ins.subproducto ?? p.subproducto,
      precio_registrado: ins.precio_unitario != null ? String(ins.precio_unitario) : p.precio_registrado,
    }));
    setInsumoQ(ins.nombre);
    setSubprodQ(ins.subproducto ?? "");
    setShowInsumoDrop(false);
  }

  function openCrear() {
    setForm(EMPTY);
    setInsumoQ(""); setRenglonQ("266"); setSubprodQ("");
    setError(""); setModal("crear");
  }

  function openEditar(s: Servicio) {
    setSelected(s);
    setForm({
      tipo_documento:    (s.tipo_documento || "SIAF") as TipoDoc,
      fecha:             s.fecha,
      cuatrimestre:      (s.cuatrimestre ?? "PRIMERO") as "PRIMERO" | "SEGUNDO" | "TERCERO",
      renglon:           String(s.renglon ?? "266"),
      codigo_igss:       String(s.codigo_igss ?? ""),
      insumo:            s.insumo ?? "",
      cantidad:          s.cantidad?.toString() ?? "",
      precio_registrado: s.precio_registrado?.toString() ?? "",
      subproducto:       s.subproducto ?? "",
      numero_compra:     s.numero_compra ?? "",
      numero_documento:  s.numero_documento ?? "",
      estado_oc:         s.estado_oc ?? "Recibido",
    });
    setInsumoQ(s.insumo ?? "");
    setRenglonQ(String(s.renglon ?? "266"));
    setSubprodQ(s.subproducto ?? "");
    setError(""); setModal("editar");
  }

  async function handleCrear() {
    if (!form.fecha || !form.insumo) return setError("Fecha e insumo son obligatorios");
    setLoading(true);
    const res = await crearServicio({ ...form, renglon: renglonQ });
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(p => [res.servicio!, ...p] as unknown as Servicio[]);
    setModal(null);
  }

  async function handleEditar() {
    if (!selected) return;
    setLoading(true);
    const res = await editarServicio({ id: selected.id, ...form, renglon: renglonQ });
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(p => p.map(s => s.id === selected.id
      ? { ...s, ...form, renglon: Number(renglonQ) || null,
          cantidad: form.cantidad ? parseFloat(form.cantidad) : null,
          precio_registrado: form.precio_registrado ? parseFloat(form.precio_registrado) : null }
      : s) as unknown as Servicio[]);
    setModal(null);
  }

  async function handleEliminar(id: number) {
    if (!confirm("¿Eliminar este registro?")) return;
    await eliminarServicio(id);
    setLista(p => p.filter(s => s.id !== id));
  }

  const corrLabel = `${TIPO_PREFIJO[form.tipo_documento] ?? form.tipo_documento}-${String(nextCorr).padStart(3, "0")}`;

  const totalCalc = form.cantidad && form.precio_registrado
    ? parseFloat(form.cantidad) * parseFloat(form.precio_registrado)
    : null;

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

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar SIAF, insumo, tipo…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Tipo / Corr.</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Cuatrimestre</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Renglón</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Insumo</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Cantidad</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">P. Unit.</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Subproducto</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">OC</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                {canEdit && <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(s => {
                const total = s.cantidad != null && s.precio_registrado != null
                  ? s.cantidad * s.precio_registrado : null;
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLOR[s.tipo_documento] ?? "bg-gray-100 text-gray-700"}`}>
                        {TIPO_PREFIJO[s.tipo_documento] ?? s.tipo_documento}
                      </span>
                      <p className="font-mono text-xs text-gray-600 mt-0.5">
                        {String(s.siaf_numero ?? "—").padStart(3, "0")}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{s.fecha}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{s.cuatrimestre ?? "—"}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">{s.renglon ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-gray-900 max-w-[200px] truncate" title={s.insumo ?? ""}>{s.insumo ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 whitespace-nowrap">
                      {s.cantidad != null ? s.cantidad.toLocaleString("es-GT") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 whitespace-nowrap">
                      {s.precio_registrado != null ? `Q ${s.precio_registrado.toFixed(4)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900 whitespace-nowrap">
                      {total != null ? `Q ${total.toLocaleString("es-GT", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap max-w-[120px] truncate" title={s.subproducto ?? ""}>{s.subproducto ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{s.numero_compra ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.estado_oc === "Recibido" ? "bg-green-100 text-green-700" :
                        s.estado_oc === "Pendiente" ? "bg-yellow-100 text-yellow-700" :
                        s.estado_oc === "Anulado" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>{s.estado_oc ?? "—"}</span>
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
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">No hay registros</div>
          )}
        </div>
      </div>

      {/* ── Modal crear / editar ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-xl max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-900">
                {modal === "crear" ? "Nuevo ingreso de servicio" : `Editar — ${TIPO_PREFIJO[form.tipo_documento]}-${String(selected?.siaf_numero ?? "").padStart(3, "0")}`}
              </h2>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">

              {/* ① Tipo de documento + Correlativo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo de documento *</label>
                  <select className="input" value={form.tipo_documento}
                    onChange={e => set("tipo_documento", e.target.value)}
                    disabled={modal === "editar"}>
                    {TIPOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Correlativo</label>
                  <div className="input bg-gray-50 font-mono text-gray-700 flex items-center gap-2">
                    {modal === "crear"
                      ? corrLoading ? <span className="text-gray-400">Calculando…</span>
                        : <><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />{corrLabel}</>
                      : `${TIPO_PREFIJO[form.tipo_documento] ?? form.tipo_documento}-${String(selected?.siaf_numero ?? "").padStart(3, "0")}`
                    }
                  </div>
                </div>
              </div>

              {/* ② Fecha + Cuatrimestre */}
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

              {/* ③ Renglón — autocomplete */}
              <div className="relative">
                <label className="label">Renglón</label>
                <div className="relative">
                  <input className="input pr-8" value={renglonQ}
                    onChange={e => { setRenglonQ(e.target.value); setShowRenglonDrop(true); }}
                    onFocus={() => setShowRenglonDrop(true)}
                    onBlur={() => setTimeout(() => setShowRenglonDrop(false), 150)}
                    placeholder="266 — Productos farmacéuticos…" />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                {showRenglonDrop && renglonSugg.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {renglonSugg.map(r => (
                      <button key={r.r} type="button"
                        onMouseDown={() => { setRenglonQ(String(r.r)); setShowRenglonDrop(false); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors border-b border-gray-50 last:border-0 flex items-start gap-3">
                        <span className="font-mono text-sm font-bold text-gray-800 shrink-0">{r.r}</span>
                        <span className="text-xs text-gray-500">{r.d}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ④ Insumo — autocomplete desde catálogo */}
              <div className="relative">
                <label className="label">Insumo *</label>
                <div className="relative">
                  <input className="input pr-8" value={insumoQ}
                    onChange={e => {
                      setInsumoQ(e.target.value);
                      set("insumo", e.target.value);
                      set("codigo_igss", "");
                      setShowInsumoDrop(true);
                    }}
                    onFocus={() => setShowInsumoDrop(true)}
                    onBlur={() => setTimeout(() => setShowInsumoDrop(false), 150)}
                    placeholder="Buscar por nombre o código IGSS…" />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                {showInsumoDrop && insumoSugg.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {insumoSugg.map(ins => (
                      <button key={ins.codigo_igss} type="button"
                        onMouseDown={() => pickInsumo(ins)}
                        className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors border-b border-gray-50 last:border-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{ins.nombre}</p>
                        <p className="text-xs text-gray-400">
                          Cód. {ins.codigo_igss} · {ins.subproducto}
                          {ins.precio_unitario != null && ` · Q ${ins.precio_unitario.toFixed(4)}`}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {form.codigo_igss && (
                  <p className="text-xs text-brand-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Código IGSS: <strong>{form.codigo_igss}</strong>
                  </p>
                )}
              </div>

              {/* ⑤ Cantidad + Precio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Cantidad</label>
                  <input className="input" type="number" step="0.01" value={form.cantidad}
                    onChange={e => set("cantidad", e.target.value)}
                    placeholder="0" />
                </div>
                <div>
                  <label className="label">Precio unitario (Q)</label>
                  <input className="input" type="number" step="0.0001" value={form.precio_registrado}
                    onChange={e => set("precio_registrado", e.target.value)}
                    placeholder="Auto desde catálogo" />
                </div>
              </div>

              {/* Total calculado */}
              {totalCalc != null && (
                <div className="bg-brand-50 border border-brand-200 rounded-lg px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-brand-700 font-medium">Total calculado</span>
                  <span className="text-lg font-bold text-brand-800">
                    Q {totalCalc.toLocaleString("es-GT", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* ⑥ Subproducto — autocomplete */}
              <div className="relative">
                <label className="label">Subproducto</label>
                <div className="relative">
                  <input className="input pr-8" value={subprodQ}
                    onChange={e => {
                      setSubprodQ(e.target.value);
                      set("subproducto", e.target.value);
                      setShowSubprodDrop(true);
                    }}
                    onFocus={() => setShowSubprodDrop(true)}
                    onBlur={() => setTimeout(() => setShowSubprodDrop(false), 150)}
                    placeholder="Selecciona o escribe el subproducto…" />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                {showSubprodDrop && subprodSugg.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {subprodSugg.map(s => (
                      <button key={s} type="button"
                        onMouseDown={() => { setSubprodQ(s); set("subproducto", s); setShowSubprodDrop(false); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-brand-50 text-sm text-gray-700 border-b border-gray-50 last:border-0">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ⑦ Datos adicionales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">N° Orden de Compra</label>
                  <input className="input" value={form.numero_compra}
                    onChange={e => set("numero_compra", e.target.value)}
                    placeholder="OC-2026-001" />
                </div>
                <div>
                  <label className="label">N° Documento</label>
                  <input className="input" value={form.numero_documento}
                    onChange={e => set("numero_documento", e.target.value)} />
                </div>
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
