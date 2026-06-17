"use client";
import { useState, useMemo } from "react";
import { Wallet, Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { crearGasto, editarGasto, eliminarGasto } from "./actions";

type Gasto = {
  id: number; numero_cheque: string|null; numero_vale: number|null;
  tipo_documento: string|null; numero_documento: string|null;
  numero_serie: string|null; fecha: string|null;
  nombre_beneficiario: string|null; municipio_residencia: string|null;
  municipio_cita: string|null; costo: number|null;
  tipo_servicio: string|null; fecha_pago: string|null;
};

const EMPTY = {
  numero_cheque: "", numero_vale: "", tipo_documento: "Factura",
  numero_documento: "", numero_serie: "", fecha: new Date().toISOString().slice(0,10),
  nombre_beneficiario: "", municipio_residencia: "Tejutla", municipio_cita: "Tejutla",
  costo: "", tipo_servicio: "", fecha_pago: "",
};

interface Props { gastos: Gasto[]; canEdit: boolean; }

export default function CajaChicaClient({ gastos: init, canEdit }: Props) {
  const [lista,    setLista]    = useState(init);
  const [query,    setQuery]    = useState("");
  const [modal,    setModal]    = useState<"crear"|"editar"|null>(null);
  const [selected, setSelected] = useState<Gasto|null>(null);
  const [form,     setForm]     = useState<any>(EMPTY);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [grupoCheque, setGrupoCheque] = useState<string|null>(null);

  const filtered = useMemo(() => {
    let r = lista;
    if (query) r = r.filter(g =>
      (g.nombre_beneficiario ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (g.numero_cheque ?? "").includes(query) ||
      (g.tipo_servicio ?? "").toLowerCase().includes(query.toLowerCase())
    );
    if (grupoCheque) r = r.filter(g => g.numero_cheque === grupoCheque);
    return r;
  }, [lista, query, grupoCheque]);

  // cheques únicos para el filtro agrupador
  const cheques = useMemo(() =>
    [...new Set(lista.map(g => g.numero_cheque).filter(Boolean))],
    [lista]);

  const totalFiltrado = useMemo(() =>
    filtered.reduce((a, g) => a + (g.costo ?? 0), 0), [filtered]);

  function set(k: string, v: string) { setForm((p: any) => ({ ...p, [k]: v })); }

  function openCrear() { setForm(EMPTY); setError(""); setModal("crear"); }
  function openEditar(g: Gasto) {
    setSelected(g);
    setForm({
      numero_cheque:       g.numero_cheque ?? "",
      numero_vale:         String(g.numero_vale ?? ""),
      tipo_documento:      g.tipo_documento ?? "Factura",
      numero_documento:    g.numero_documento ?? "",
      numero_serie:        g.numero_serie ?? "",
      fecha:               g.fecha ?? "",
      nombre_beneficiario: g.nombre_beneficiario ?? "",
      municipio_residencia:g.municipio_residencia ?? "",
      municipio_cita:      g.municipio_cita ?? "",
      costo:               g.costo?.toString() ?? "",
      tipo_servicio:       g.tipo_servicio ?? "",
      fecha_pago:          g.fecha_pago ?? "",
    });
    setError(""); setModal("editar");
  }

  async function handleCrear() {
    if (!form.nombre_beneficiario || !form.costo) return setError("Beneficiario y costo son obligatorios");
    setLoading(true);
    const res = await crearGasto(form);
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(p => [res.gasto!, ...p]);
    setModal(null);
  }

  async function handleEditar() {
    if (!selected) return;
    setLoading(true);
    const res = await editarGasto({ id: selected.id, ...form });
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(p => p.map(g => g.id === selected.id ? { ...g, ...form } : g));
    setModal(null);
  }

  async function handleEliminar(id: number) {
    if (!confirm("¿Eliminar este gasto?")) return;
    await eliminarGasto(id);
    setLista(p => p.filter(g => g.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-5 h-5" /> Caja Chica
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} registros</p>
        </div>
        {canEdit && (
          <button onClick={openCrear} className="btn-primary">
            <Plus className="w-4 h-4" /> Nuevo gasto
          </button>
        )}
      </div>

      {/* Total */}
      <div className="card p-4 flex items-center justify-between max-w-xs">
        <div>
          <p className="text-xs text-gray-500 font-medium">
            Total {grupoCheque ? `cheque ${grupoCheque}` : "filtrado"}
          </p>
          <p className="text-xl font-bold text-gray-900 mt-0.5">
            {totalFiltrado.toLocaleString("es-GT", { style:"currency", currency:"GTQ" })}
          </p>
        </div>
        <div className="p-2.5 bg-yellow-50 rounded-xl">
          <Wallet className="w-5 h-5 text-yellow-600" />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar beneficiario, servicio…"
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <select className="input w-full sm:w-auto"
          value={grupoCheque ?? ""}
          onChange={e => setGrupoCheque(e.target.value || null)}>
          <option value="">Todos los cheques</option>
          {cheques.map(c => (
            <option key={c!} value={c!}>Cheque {c}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Cheque / Vale</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Beneficiario</th>
                <th className="px-4 py-3 text-left">Servicio</th>
                <th className="px-4 py-3 text-right">Costo</th>
                {canEdit && <th className="px-4 py-3 text-right">Acc.</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(g => (
                <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-gray-700">Ch. {g.numero_cheque ?? "—"}</p>
                    <p className="text-xs text-gray-400">Vale {g.numero_vale ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {g.tipo_documento}
                    </span>
                    <p className="font-mono text-xs text-gray-400 mt-0.5">{g.numero_documento}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{g.fecha ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700 max-w-[160px] truncate">{g.nombre_beneficiario ?? "—"}</p>
                    <p className="text-xs text-gray-400">{g.municipio_cita}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-600 text-xs max-w-[200px] truncate">{g.tipo_servicio ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                    {g.costo != null ? `Q ${g.costo.toLocaleString("es-GT", { minimumFractionDigits: 2 })}` : "—"}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEditar(g)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleEliminar(g.id)}
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
            <div className="text-center py-12 text-gray-400">No hay gastos registrados</div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-900">
                {modal === "crear" ? "Nuevo gasto de caja chica" : "Editar gasto"}
              </h2>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo de documento</label>
                  <select className="input" value={form.tipo_documento}
                    onChange={e => set("tipo_documento", e.target.value)}>
                    <option>Factura</option>
                    <option>Formulario</option>
                    <option>Vale</option>
                  </select>
                </div>
                <div>
                  <label className="label">Fecha</label>
                  <input className="input" type="date" value={form.fecha}
                    onChange={e => set("fecha", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              </div>
              <div>
                <label className="label">Nombre del beneficiario *</label>
                <input className="input" value={form.nombre_beneficiario}
                  onChange={e => set("nombre_beneficiario", e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Municipio residencia</label>
                  <input className="input" value={form.municipio_residencia}
                    onChange={e => set("municipio_residencia", e.target.value)} />
                </div>
                <div>
                  <label className="label">Municipio cita</label>
                  <input className="input" value={form.municipio_cita}
                    onChange={e => set("municipio_cita", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Tipo de servicio</label>
                <textarea className="input" rows={2} value={form.tipo_servicio}
                  onChange={e => set("tipo_servicio", e.target.value)}
                  placeholder="Descripción del servicio o gasto…" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Costo (Q) *</label>
                  <input className="input" type="number" step="0.01" value={form.costo}
                    onChange={e => set("costo", e.target.value)} />
                </div>
                <div>
                  <label className="label">Fecha de pago</label>
                  <input className="input" type="date" value={form.fecha_pago}
                    onChange={e => set("fecha_pago", e.target.value)} />
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
                {loading ? "Guardando…" : (modal === "crear" ? "Registrar gasto" : "Guardar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
