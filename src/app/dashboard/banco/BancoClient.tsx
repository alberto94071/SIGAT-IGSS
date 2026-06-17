"use client";
import { useState, useMemo } from "react";
import { Landmark, Plus, Pencil, X, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { crearMovimiento, editarMovimiento, calcularMontoDesdeChecks } from "./actions";

type Mov = {
  id: number; mes: string|null; numero_documento: string|null;
  tipo_documento: string|null; status: string|null;
  fecha_movimiento: string; nit_beneficiario: string|null;
  beneficiario: string|null; descripcion: string|null;
  egresos: number|null; ingresos: number|null; saldo: number|null;
  creado_por: number|null; created_at: string|null;
};

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const EMPTY = {
  mes: MESES[new Date().getMonth()],
  numero_documento: "", tipo_documento: "Cheque",
  status: "Pagado", fecha_movimiento: new Date().toISOString().slice(0,10),
  nit_beneficiario: "", beneficiario: "", descripcion: "",
  egresos: "", ingresos: "",
};

interface Props { movimientos: Mov[]; canEdit: boolean; }

export default function BancoClient({ movimientos: init, canEdit }: Props) {
  const [lista,   setLista]   = useState(init);
  const [modal,   setModal]   = useState<"crear"|"editar"|null>(null);
  const [selected,setSelected]= useState<Mov|null>(null);
  const [form,    setForm]    = useState<any>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [autoLoad,setAutoLoad]= useState(false);
  const [mesFiltro, setMesFiltro] = useState("todos");

  const filtered = useMemo(() =>
    mesFiltro === "todos" ? lista : lista.filter(m => m.mes === mesFiltro),
    [lista, mesFiltro]);

  // último saldo
  const saldoActual = lista.length > 0
    ? (lista[lista.length - 1].saldo ?? 0)
    : 0;

  const totalEgresos = useMemo(() =>
    filtered.reduce((a, m) => a + (m.egresos ?? 0), 0), [filtered]);
  const totalIngresos = useMemo(() =>
    filtered.reduce((a, m) => a + (m.ingresos ?? 0), 0), [filtered]);

  function set(k: string, v: string) { setForm((p: any) => ({ ...p, [k]: v })); }

  function openCrear() {
    setForm(EMPTY); setError(""); setAutoLoad(false); setModal("crear");
  }

  function openEditar(m: Mov) {
    setSelected(m);
    setForm({
      mes:              m.mes ?? "",
      numero_documento: m.numero_documento ?? "",
      tipo_documento:   m.tipo_documento ?? "Cheque",
      status:           m.status ?? "Pagado",
      fecha_movimiento: m.fecha_movimiento,
      nit_beneficiario: m.nit_beneficiario ?? "",
      beneficiario:     m.beneficiario ?? "",
      descripcion:      m.descripcion ?? "",
      egresos:          m.egresos?.toString() ?? "",
      ingresos:         m.ingresos?.toString() ?? "",
    });
    setError(""); setModal("editar");
  }

  // Autocargar monto del cheque desde pagos
  async function cargarMonto() {
    if (!form.numero_documento) return;
    setAutoLoad(true);
    const res = await calcularMontoDesdeChecks(form.numero_documento);
    setAutoLoad(false);
    if (res.monto && res.monto > 0) {
      setForm((p: any) => ({
        ...p,
        egresos: res.monto!.toFixed(2),
        beneficiario: res.proveedor ?? p.beneficiario,
        nit_beneficiario: res.nit ?? p.nit_beneficiario,
      }));
    }
  }

  async function handleCrear() {
    if (!form.fecha_movimiento) return setError("La fecha es obligatoria");
    setLoading(true);
    const res = await crearMovimiento(form);
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(p => [...p, res.mov!]);
    setModal(null);
  }

  async function handleEditar() {
    if (!selected) return;
    setLoading(true);
    const res = await editarMovimiento({ id: selected.id, ...form });
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(p => p.map(m => m.id === selected.id
      ? { ...m, ...form } : m));
    setModal(null);
  }

  const fmtQ = (n: number|null) =>
    n != null ? n.toLocaleString("es-GT", { style:"currency", currency:"GTQ" }) : "—";

  const TIPO_COLORS: Record<string, string> = {
    Cheque:    "bg-blue-100 text-blue-700",
    Deposito:  "bg-green-100 text-green-700",
    Vale:      "bg-yellow-100 text-yellow-700",
    Formulario:"bg-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Landmark className="w-5 h-5" /> Banco
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} movimientos</p>
        </div>
        {canEdit && (
          <button onClick={openCrear} className="btn-primary">
            <Plus className="w-4 h-4" /> Registrar movimiento
          </button>
        )}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Saldo actual</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              {saldoActual.toLocaleString("es-GT", { style:"currency", currency:"GTQ" })}
            </p>
          </div>
          <div className="p-2.5 bg-blue-50 rounded-xl">
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Egresos {mesFiltro !== "todos" ? mesFiltro : "(total)"}</p>
            <p className="text-xl font-bold text-red-700 mt-0.5">
              {totalEgresos.toLocaleString("es-GT", { style:"currency", currency:"GTQ" })}
            </p>
          </div>
          <div className="p-2.5 bg-red-50 rounded-xl">
            <TrendingDown className="w-5 h-5 text-red-600" />
          </div>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Ingresos {mesFiltro !== "todos" ? mesFiltro : "(total)"}</p>
            <p className="text-xl font-bold text-green-700 mt-0.5">
              {totalIngresos.toLocaleString("es-GT", { style:"currency", currency:"GTQ" })}
            </p>
          </div>
          <div className="p-2.5 bg-green-50 rounded-xl">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
        </div>
      </div>

      {/* Filtro por mes */}
      <div className="flex gap-1 flex-wrap">
        <button onClick={() => setMesFiltro("todos")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mesFiltro === "todos" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          Todos
        </button>
        {MESES.map(m => (
          <button key={m} onClick={() => setMesFiltro(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mesFiltro === m ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {m}
          </button>
        ))}
      </div>

      {/* Tabla libro banco */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Mes</th>
                <th className="px-4 py-3 text-left">Tipo / N° Doc.</th>
                <th className="px-4 py-3 text-left">Beneficiario</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-right">Egresos</th>
                <th className="px-4 py-3 text-right">Ingresos</th>
                <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{m.fecha_movimiento}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{m.mes}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLORS[m.tipo_documento ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
                      {m.tipo_documento}
                    </span>
                    <p className="font-mono text-xs text-gray-500 mt-0.5">{m.numero_documento}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700 max-w-[160px] truncate">{m.beneficiario ?? "—"}</p>
                    <p className="text-xs text-gray-400">{m.nit_beneficiario}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-600 text-xs max-w-[200px] truncate">{m.descripcion ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {(m.egresos ?? 0) > 0
                      ? <span className="text-red-700 font-medium">{fmtQ(m.egresos)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {(m.ingresos ?? 0) > 0
                      ? <span className="text-green-700 font-medium">{fmtQ(m.ingresos)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900">
                    {fmtQ(m.saldo)}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <button onClick={() => openEditar(m)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {/* Totales del período */}
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Total {mesFiltro !== "todos" ? mesFiltro : "acumulado"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-red-700">
                  {totalEgresos.toLocaleString("es-GT", { style:"currency", currency:"GTQ" })}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-green-700">
                  {totalIngresos.toLocaleString("es-GT", { style:"currency", currency:"GTQ" })}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900">
                  {saldoActual.toLocaleString("es-GT", { style:"currency", currency:"GTQ" })}
                </td>
                {canEdit && <td />}
              </tr>
            </tfoot>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">No hay movimientos</div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-900">
                {modal === "crear" ? "Nuevo movimiento bancario" : "Editar movimiento"}
              </h2>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Mes</label>
                  <select className="input" value={form.mes} onChange={e => set("mes", e.target.value)}>
                    {MESES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Fecha *</label>
                  <input className="input" type="date" value={form.fecha_movimiento}
                    onChange={e => set("fecha_movimiento", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo de documento</label>
                  <select className="input" value={form.tipo_documento}
                    onChange={e => set("tipo_documento", e.target.value)}>
                    <option>Cheque</option>
                    <option>Deposito</option>
                    <option>Vale</option>
                    <option>Formulario</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status}
                    onChange={e => set("status", e.target.value)}>
                    <option>Pagado</option>
                    <option>Operado</option>
                    <option>Pendiente</option>
                    <option>Anulado</option>
                  </select>
                </div>
              </div>

              {/* N° documento con botón autocargar */}
              <div>
                <label className="label">N° Documento / Cheque</label>
                <div className="flex gap-2">
                  <input className="input flex-1" value={form.numero_documento}
                    onChange={e => set("numero_documento", e.target.value)} />
                  {form.tipo_documento === "Cheque" && (
                    <button type="button" onClick={cargarMonto}
                      disabled={autoLoad || !form.numero_documento}
                      className="btn-secondary whitespace-nowrap text-xs">
                      {autoLoad ? "Calculando…" : "↓ Autocargar monto"}
                    </button>
                  )}
                </div>
                {form.tipo_documento === "Cheque" && (
                  <p className="text-xs text-gray-400 mt-1">
                    Ingresa el N° de cheque y presiona "Autocargar monto" para sumar todos los pagos asociados.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">NIT Beneficiario</label>
                  <input className="input" value={form.nit_beneficiario}
                    onChange={e => set("nit_beneficiario", e.target.value)} />
                </div>
                <div>
                  <label className="label">Beneficiario</label>
                  <input className="input" value={form.beneficiario}
                    onChange={e => set("beneficiario", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">Descripción</label>
                <textarea className="input" rows={2} value={form.descripcion}
                  onChange={e => set("descripcion", e.target.value)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Egresos (Q)</label>
                  <input className="input" type="number" step="0.01" value={form.egresos}
                    onChange={e => set("egresos", e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="label">Ingresos (Q)</label>
                  <input className="input" type="number" step="0.01" value={form.ingresos}
                    onChange={e => set("ingresos", e.target.value)} placeholder="0.00" />
                </div>
              </div>

              {/* Preview saldo */}
              {(form.egresos || form.ingresos) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
                  <p className="text-xs text-blue-600 font-medium">Nuevo saldo estimado</p>
                  <p className="text-lg font-bold text-blue-800 mt-0.5">
                    {(saldoActual - parseFloat(form.egresos||"0") + parseFloat(form.ingresos||"0"))
                      .toLocaleString("es-GT", { style:"currency", currency:"GTQ" })}
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="mx-5 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
              <button onClick={modal === "crear" ? handleCrear : handleEditar}
                disabled={loading} className="btn-primary">
                {loading ? "Guardando…" : (modal === "crear" ? "Registrar" : "Guardar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
