"use client";
import { useMemo, useState } from "react";
import { Scale, Search, CheckCircle2, Undo2, Loader2 } from "lucide-react";
import { marcarConciliado, desmarcarConciliado, type MovimientoConciliacion } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import { fechaGuatemala } from "@/lib/date-utils";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function LibroConciliacionClient({ movimientos: init }: { movimientos: MovimientoConciliacion[] }) {
  const [movimientos, setMovimientos] = useState(init);
  const [query, setQuery] = useState("");
  const [fechaPorFila, setFechaPorFila] = useState<Record<string, string>>({});
  const [acciones, setAcciones] = useState<Record<string, { cargando: boolean; error: string | null }>>({});

  const q = query.toLowerCase().trim();
  const filtrados = useMemo(() => !q ? movimientos : movimientos.filter(m =>
    (m.beneficiario ?? "").toLowerCase().includes(q) ||
    (m.numero_cheque ?? "").toLowerCase().includes(q) ||
    `${m.numero_a04 ?? ""}/${m.anio_a04 ?? ""}`.includes(q) ||
    m.fecha.includes(q)
  ), [movimientos, q]);

  const pendientes = movimientos.filter(m => !m.conciliado);
  const totalPendiente = pendientes.reduce((s, m) => s + m.debe, 0);

  async function conciliar(m: MovimientoConciliacion) {
    const fecha = fechaPorFila[m.id] || fechaGuatemala();
    setAcciones(prev => ({ ...prev, [m.id]: { cargando: true, error: null } }));
    const res = await marcarConciliado(m.pagoId as number, fecha);
    if ("error" in res) {
      setAcciones(prev => ({ ...prev, [m.id]: { cargando: false, error: res.error } }));
      return;
    }
    setAcciones(prev => ({ ...prev, [m.id]: { cargando: false, error: null } }));
    setMovimientos(prev => prev.map(x => x.id === m.id ? { ...x, conciliado: true, fecha_conciliacion: fecha } : x));
  }

  async function desconciliar(m: MovimientoConciliacion) {
    setAcciones(prev => ({ ...prev, [m.id]: { cargando: true, error: null } }));
    const res = await desmarcarConciliado(m.pagoId as number);
    if ("error" in res) {
      setAcciones(prev => ({ ...prev, [m.id]: { cargando: false, error: res.error } }));
      return;
    }
    setAcciones(prev => ({ ...prev, [m.id]: { cargando: false, error: null } }));
    setMovimientos(prev => prev.map(x => x.id === m.id ? { ...x, conciliado: false, fecha_conciliacion: null } : x));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Scale className="w-5 h-5" /> Libro Conciliación
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Cotejo de cada cheque emitido contra el estado de cuenta del banco.
          {" "}{pendientes.length} pendiente(s) de conciliar {pendientes.length > 0 && <>· {Q(totalPendiente)}</>}
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por cheque, beneficiario, A-04, fecha…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha emisión</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Cheque</th>
                <th className="px-4 py-3 text-left">Beneficiario</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">A-04</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Monto</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Conciliación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(m => {
                const a = acciones[m.id];
                return (
                  <tr key={m.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{m.fecha || "—"}</td>
                    <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{m.numero_cheque ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{m.beneficiario ?? "—"}</p>
                      <p className="text-xs text-gray-400">{m.descripcion}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">
                      {m.numero_a04 != null ? `${m.numero_a04}/${m.anio_a04}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap">{Q(m.debe)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {m.conciliado ? (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3 h-3" /> Conciliado {m.fecha_conciliacion}
                          </span>
                          <button onClick={() => desconciliar(m)} disabled={a?.cargando}
                            title="Deshacer" className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-50">
                            {a?.cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input type="date" className="input py-1 text-xs rounded-lg"
                            value={fechaPorFila[m.id] ?? fechaGuatemala()}
                            onChange={e => setFechaPorFila(prev => ({ ...prev, [m.id]: e.target.value }))} />
                          <button onClick={() => conciliar(m)} disabled={a?.cargando}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
                            {a?.cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Conciliar
                          </button>
                        </div>
                      )}
                      {a?.error && <p className="text-xs text-red-600 mt-1">{a.error}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtrados.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Scale className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{q ? "Sin resultados para esa búsqueda." : "Todavía no hay cheques emitidos para conciliar."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
