"use client";
import { useState, useMemo } from "react";
import {
  CreditCard, Plus, Pencil, Search, X,
  ToggleLeft, ToggleRight, CheckCircle2, Clock, Ban
} from "lucide-react";
import { crearPago, editarPago, cambiarEstatus } from "./actions";

type Pago = {
  id: number; siaf_numero: number|null; numero_oc: string|null;
  renglon: number|null; codigo_igss: number|null; codigo_ppr: string|null;
  descripcion: string|null; unidad_medida: string|null; subproducto: string|null;
  cantidad: number|null; monto: number|null;
  metodo_compra: string|null; nit_proveedor: string|null; proveedor: string|null;
  numero_documento: string|null; numero_serie: string|null; fecha_documento: string|null;
  marca: string|null; modelo: string|null; serie_equipo: string|null;
  fecha_recepcion: string|null; obs_lote: string|null; npg_vencimiento: string|null;
  numero_cheque: string|null; numero_vale: number|null; numero_fri: string|null;
  estatus: "Pendiente"|"Pagado"|"Anulado";
  fecha_pagado: string|null; cuatrimestre: string|null; numero_dab: string|null;
  servicio_id: number|null;
};
type ServicioRef = {
  id: number; siaf_numero: number|null; insumo: string|null;
  cantidad: number|null; subproducto: string|null;
  codigo_igss: number|null; numero_compra: string|null;
};
type InsumoRef = {
  codigo_igss: number; nombre: string; subproducto: string|null;
  codigo_ppr: string|null; unidad_medida: string|null;
};

const EMPTY_PAGO = {
  servicio_id: "", siaf_numero: "", numero_oc: "", renglon: "266",
  codigo_igss: "", codigo_ppr: "", descripcion: "", unidad_medida: "", subproducto: "",
  cantidad: "", monto: "", metodo_compra: "Baja Cuantia", nit_proveedor: "", proveedor: "",
  numero_documento: "", numero_serie: "", fecha_documento: "",
  marca: "", modelo: "", serie_equipo: "", fecha_recepcion: "", obs_lote: "", npg_vencimiento: "",
  numero_cheque: "", numero_vale: "", numero_fri: "",
  estatus: "Pendiente", fecha_pagado: "", cuatrimestre: "PRIMERO", numero_dab: "",
};

const ESTATUSES = {
  Pendiente: { cls: "badge-pendiente", icon: <Clock className="w-3 h-3" /> },
  Pagado:    { cls: "badge-pagado",    icon: <CheckCircle2 className="w-3 h-3" /> },
  Anulado:   { cls: "badge-anulado",   icon: <Ban className="w-3 h-3" /> },
};

interface Props {
  pagos: Pago[]; servicios: ServicioRef[];
  catalogo: InsumoRef[]; canEdit: boolean;
}

export default function PagosClient({ pagos: init, servicios, catalogo, canEdit }: Props) {
  const [lista,      setLista]      = useState(init);
  const [query,      setQuery]      = useState("");
  const [filtroEst,  setFiltroEst]  = useState<string>("todos");
  const [modal,      setModal]      = useState<"crear"|"editar"|null>(null);
  const [modo,       setModo]       = useState<"servicio"|"manual">("servicio");
  const [selected,   setSelected]   = useState<Pago|null>(null);
  const [form,       setForm]       = useState<any>(EMPTY_PAGO);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [servQ,      setServQ]      = useState("");

  const filtered = useMemo(() =>
    lista.filter(p => {
      const okQ  = !query ||
        (p.descripcion ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (p.numero_cheque ?? "").includes(query) ||
        (p.proveedor ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (p.numero_oc ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (p.numero_dab ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (p.codigo_ppr ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (p.subproducto ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (p.numero_documento ?? "").includes(query) ||
        String(p.codigo_igss ?? "").includes(query) ||
        String(p.siaf_numero ?? "").includes(query);
      const okEst = filtroEst === "todos" || p.estatus === filtroEst;
      return okQ && okEst;
    }), [lista, query, filtroEst]);

  const servSuggestions = useMemo(() =>
    !servQ ? [] :
    servicios.filter(s =>
      (s.insumo ?? "").toLowerCase().includes(servQ.toLowerCase()) ||
      String(s.siaf_numero ?? "").includes(servQ) ||
      (s.numero_compra ?? "").includes(servQ)
    ).slice(0, 8), [servQ, servicios]);

  function set(k: string, v: string) { setForm((p: any) => ({ ...p, [k]: v })); }

  function pickServicio(s: ServicioRef) {
    const matched = catalogo.find(c => c.codigo_igss === s.codigo_igss);
    setForm((p: any) => ({
      ...p,
      servicio_id: String(s.id),
      siaf_numero: String(s.siaf_numero ?? ""),
      codigo_igss: String(s.codigo_igss ?? ""),
      codigo_ppr:  matched?.codigo_ppr ?? "",
      descripcion: s.insumo ?? "",
      unidad_medida: matched?.unidad_medida ?? "",
      subproducto: s.subproducto ?? "",
      cantidad:    s.cantidad?.toString() ?? "",
      numero_oc:   s.numero_compra ?? "",
    }));
    setServQ(s.insumo ?? "");
  }

  function openCrear() {
    setForm(EMPTY_PAGO); setServQ(""); setError("");
    setModo("servicio"); setModal("crear");
  }

  function openEditar(p: Pago) {
    setSelected(p);
    setForm({
      servicio_id:      String(p.servicio_id ?? ""),
      siaf_numero:      String(p.siaf_numero ?? ""),
      numero_oc:        p.numero_oc ?? "",
      renglon:          String(p.renglon ?? "266"),
      codigo_igss:      String(p.codigo_igss ?? ""),
      codigo_ppr:       p.codigo_ppr ?? "",
      descripcion:      p.descripcion ?? "",
      unidad_medida:    p.unidad_medida ?? "",
      subproducto:      p.subproducto ?? "",
      cantidad:         p.cantidad?.toString() ?? "",
      monto:            p.monto?.toString() ?? "",
      metodo_compra:    p.metodo_compra ?? "Baja Cuantia",
      nit_proveedor:    p.nit_proveedor ?? "",
      proveedor:        p.proveedor ?? "",
      numero_documento: p.numero_documento ?? "",
      numero_serie:     p.numero_serie ?? "",
      fecha_documento:  p.fecha_documento ?? "",
      marca:            p.marca ?? "",
      modelo:           p.modelo ?? "",
      serie_equipo:     p.serie_equipo ?? "",
      fecha_recepcion:  p.fecha_recepcion ?? "",
      obs_lote:         p.obs_lote ?? "",
      npg_vencimiento:  p.npg_vencimiento ?? "",
      numero_cheque:    p.numero_cheque ?? "",
      numero_vale:      String(p.numero_vale ?? ""),
      numero_fri:       p.numero_fri ?? "",
      estatus:          p.estatus,
      fecha_pagado:     p.fecha_pagado ?? "",
      cuatrimestre:     p.cuatrimestre ?? "PRIMERO",
      numero_dab:       p.numero_dab ?? "",
    });
    setError(""); setModal("editar");
  }

  async function handleCrear() {
    if (!form.descripcion) return setError("El insumo es obligatorio");
    setLoading(true);
    const res = await crearPago(form);
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(p => [res.pago!, ...p] as unknown as Pago[]);
    setModal(null);
  }

  async function handleEditar() {
    if (!selected) return;
    setLoading(true);
    const res = await editarPago({ id: selected.id, ...form });
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(p => p.map(x => x.id === selected.id ? { ...x, ...form } : x));
    setModal(null);
  }

  async function handleEstatus(p: Pago, estatus: "Pendiente"|"Pagado"|"Anulado") {
    await cambiarEstatus({ id: p.id, estatus });
    setLista(prev => prev.map(x => x.id === p.id ? { ...x, estatus } : x));
  }

  const fmtQ = (n: number|null) =>
    n != null ? `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2 })}` : "—";

  const totales = useMemo(() => ({
    pendiente: filtered.filter(p => p.estatus === "Pendiente").reduce((a, p) => a + (p.monto ?? 0), 0),
    pagado:    filtered.filter(p => p.estatus === "Pagado").reduce((a, p) => a + (p.monto ?? 0), 0),
  }), [filtered]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5" /> Pagos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} registros</p>
        </div>
        {canEdit && (
          <button onClick={openCrear} className="btn-primary">
            <Plus className="w-4 h-4" /> Nuevo pago
          </button>
        )}
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Pendiente de pago</p>
            <p className="text-xl font-bold text-yellow-700 mt-0.5">
              {totales.pendiente.toLocaleString("es-GT", { style:"currency", currency:"GTQ" })}
            </p>
          </div>
          <div className="p-2.5 bg-yellow-50 rounded-xl">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Total pagado</p>
            <p className="text-xl font-bold text-green-700 mt-0.5">
              {totales.pagado.toLocaleString("es-GT", { style:"currency", currency:"GTQ" })}
            </p>
          </div>
          <div className="p-2.5 bg-green-50 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar insumo, cheque, proveedor…"
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          {["todos","Pendiente","Pagado","Anulado"].map(e => (
            <button key={e}
              onClick={() => setFiltroEst(e)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${filtroEst === e ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {e === "todos" ? "Todos" : e}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap"># Siaf-01</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Dab-60</th>
                <th className="px-4 py-3 text-left whitespace-nowrap"># ORDEN DE COMPRA</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Renglón</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Código IGSS</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Código PpR</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">DESCRIPCIÓN</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Subproducto</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Cantidad</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Monto Compra</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">PROVEEDOR</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Método Compra</th>
                <th className="px-4 py-3 text-left whitespace-nowrap"># Documento</th>
                <th className="px-4 py-3 text-left whitespace-nowrap"># Serie</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha Documento</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">FECHA RECEPCIÓN</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Obs/Lote</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">NPG y/o Vencimiento</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Cheque</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Vale</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">FRI</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Estatus</th>
                {canEdit && <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => {
                const est = ESTATUSES[p.estatus] ?? ESTATUSES.Pendiente;
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{p.siaf_numero ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.numero_dab ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.numero_oc ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.renglon ?? "—"}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">{p.codigo_igss ?? "—"}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">{p.codigo_ppr ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-gray-900 max-w-[220px] truncate" title={p.descripcion ?? ""}>{p.descripcion ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap max-w-[150px] truncate" title={p.subproducto ?? ""}>
                      {p.subproducto ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 whitespace-nowrap">
                      {p.cantidad != null ? p.cantidad.toLocaleString("es-GT") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900 whitespace-nowrap">
                      {fmtQ(p.monto)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-gray-700 max-w-[180px] truncate" title={p.proveedor ?? ""}>{p.proveedor ?? "—"}</p>
                      <p className="text-xs text-gray-400">{p.nit_proveedor}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.metodo_compra ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.numero_documento ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.numero_serie ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.fecha_documento ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.fecha_recepcion ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap max-w-[120px] truncate" title={p.obs_lote ?? ""}>{p.obs_lote ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.npg_vencimiento ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{p.numero_cheque ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.numero_vale ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.numero_fri ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 ${est.cls}`}>
                        {est.icon}{p.estatus}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEditar(p)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {p.estatus === "Pendiente" && (
                            <button onClick={() => handleEstatus(p, "Pagado")}
                              title="Marcar como pagado"
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {p.estatus === "Pagado" && (
                            <button onClick={() => handleEstatus(p, "Pendiente")}
                              title="Revertir a pendiente"
                              className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors">
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">No hay pagos</div>
          )}
        </div>
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-900">
                {modal === "crear" ? "Nuevo pago" : "Editar pago"}
              </h2>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Toggle modo solo en crear */}
              {modal === "crear" && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <button onClick={() => setModo("servicio")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${modo === "servicio" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                    Desde servicio registrado
                  </button>
                  <button onClick={() => setModo("manual")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${modo === "manual" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                    Ingresar manualmente
                  </button>
                </div>
              )}

              {/* Búsqueda de servicio */}
              {modal === "crear" && modo === "servicio" && (
                <div className="relative">
                  <label className="label">Buscar servicio / insumo</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className="input pl-9" value={servQ}
                      onChange={e => setServQ(e.target.value)}
                      placeholder="Nombre del insumo, SIAF# o N° OC…" />
                  </div>
                  {servSuggestions.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                      {servSuggestions.map(s => (
                        <button key={s.id} type="button" onMouseDown={() => pickServicio(s)}
                          className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors border-b border-gray-50 last:border-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{s.insumo}</p>
                          <p className="text-xs text-gray-400">SIAF {s.siaf_numero} · OC {s.numero_compra} · {s.cantidad} unid.</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {form.descripcion && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-brand-700 bg-brand-50 rounded-lg px-3 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Seleccionado: <strong>{form.descripcion}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Campos del pago */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">SIAF #</label>
                  <input className="input" type="number" value={form.siaf_numero}
                    onChange={e => set("siaf_numero", e.target.value)} />
                </div>
                <div>
                  <label className="label">N° Orden de Compra</label>
                  <input className="input" value={form.numero_oc}
                    onChange={e => set("numero_oc", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Renglón</label>
                  <input className="input" type="number" value={form.renglon}
                    onChange={e => set("renglon", e.target.value)} />
                </div>
                <div>
                  <label className="label">Código IGSS</label>
                  <input className="input" type="number" value={form.codigo_igss}
                    onChange={e => set("codigo_igss", e.target.value)} />
                </div>
                <div>
                  <label className="label">Código PpR</label>
                  <input className="input" value={form.codigo_ppr}
                    onChange={e => set("codigo_ppr", e.target.value)} />
                </div>
              </div>

              {(modal === "editar" || modo === "manual") && (
                <div>
                  <label className="label">Descripción / Insumo *</label>
                  <input className="input" value={form.descripcion}
                    onChange={e => set("descripcion", e.target.value)} />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Subproducto</label>
                  <input className="input" value={form.subproducto}
                    onChange={e => set("subproducto", e.target.value)} />
                </div>
                <div>
                  <label className="label">Unidad de Medida</label>
                  <input className="input" value={form.unidad_medida}
                    onChange={e => set("unidad_medida", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Cantidad</label>
                  <input className="input" type="number" step="0.01" value={form.cantidad}
                    onChange={e => set("cantidad", e.target.value)} />
                </div>
                <div>
                  <label className="label">Monto total (Q) *</label>
                  <input className="input" type="number" step="0.01" value={form.monto}
                    onChange={e => set("monto", e.target.value)} />
                </div>
                <div>
                  <label className="label">Método de compra</label>
                  <select className="input" value={form.metodo_compra}
                    onChange={e => set("metodo_compra", e.target.value)}>
                    <option>Baja Cuantia</option>
                    <option>Compra Directa</option>
                    <option>Contrato Abierto</option>
                    <option>Casos de Excepcion</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">NIT Proveedor</label>
                  <input className="input" value={form.nit_proveedor}
                    onChange={e => set("nit_proveedor", e.target.value)} />
                </div>
                <div>
                  <label className="label">Nombre del proveedor</label>
                  <input className="input" value={form.proveedor}
                    onChange={e => set("proveedor", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">N° Documento</label>
                  <input className="input" value={form.numero_documento}
                    onChange={e => set("numero_documento", e.target.value)} />
                </div>
                <div>
                  <label className="label">N° Serie</label>
                  <input className="input" value={form.numero_serie}
                    onChange={e => set("numero_serie", e.target.value)} />
                </div>
                <div>
                  <label className="label">Fecha documento</label>
                  <input className="input" type="date" value={form.fecha_documento}
                    onChange={e => set("fecha_documento", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Fecha Recepción</label>
                  <input className="input" type="date" value={form.fecha_recepcion}
                    onChange={e => set("fecha_recepcion", e.target.value)} />
                </div>
                <div>
                  <label className="label">Obs / Lote</label>
                  <input className="input" value={form.obs_lote}
                    onChange={e => set("obs_lote", e.target.value)} />
                </div>
                <div>
                  <label className="label">NPG / Vencimiento</label>
                  <input className="input" value={form.npg_vencimiento}
                    onChange={e => set("npg_vencimiento", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Marca</label>
                  <input className="input" value={form.marca}
                    onChange={e => set("marca", e.target.value)} />
                </div>
                <div>
                  <label className="label">Modelo</label>
                  <input className="input" value={form.modelo}
                    onChange={e => set("modelo", e.target.value)} />
                </div>
                <div>
                  <label className="label">Serie Equipo</label>
                  <input className="input" value={form.serie_equipo}
                    onChange={e => set("serie_equipo", e.target.value)} />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos de pago</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">N° Cheque</label>
                    <input className="input" value={form.numero_cheque}
                      onChange={e => set("numero_cheque", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">N° Vale</label>
                    <input className="input" type="number" value={form.numero_vale}
                      onChange={e => set("numero_vale", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">N° FRI</label>
                    <input className="input" value={form.numero_fri}
                      onChange={e => set("numero_fri", e.target.value)} placeholder="FRI-2026-001" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="label">Estatus</label>
                    <select className="input" value={form.estatus}
                      onChange={e => set("estatus", e.target.value)}>
                      <option>Pendiente</option>
                      <option>Pagado</option>
                      <option>Anulado</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Fecha pagado</label>
                    <input className="input" type="date" value={form.fecha_pagado}
                      onChange={e => set("fecha_pagado", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">N° DAB</label>
                    <input className="input" value={form.numero_dab}
                      onChange={e => set("numero_dab", e.target.value)} />
                  </div>
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
                {loading ? "Guardando…" : (modal === "crear" ? "Registrar pago" : "Guardar cambios")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
