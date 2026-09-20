"use client";
import { useMemo, useState } from "react";
import { fechaGuatemala } from "@/lib/date-utils";
import Link from "next/link";
import { Landmark, X, Loader2, Send, CheckCircle2, Printer, FileEdit, Undo2, Search, BookOpen } from "lucide-react";
import { completarVoucherBancos, devolverAFormaPago, actualizarEstadoBancos, type PagoFondoRotativo, type TipoDocumentoPago, type MovimientoBancoTotal } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import { montoEnLetras } from "@/lib/adjudicacion/deletreo";
import ExpandableRow from "@/components/ExpandableRow";
import TrazabilidadPanel from "@/components/TrazabilidadPanel";
import NitAutocomplete from "@/components/adjudicacion/NitAutocomplete";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TIPO_DOC_COLOR: Record<MovimientoBancoTotal["tipoDocumento"], string> = {
  "Depósito": "bg-green-100 text-green-700",
  "Vale": "bg-amber-100 text-amber-700",
  "Factura": "bg-red-100 text-red-700",
  "Formulario": "bg-blue-100 text-blue-700",
};

const STATUS_COLOR: Record<MovimientoBancoTotal["status"], string> = {
  "Operado": "bg-gray-100 text-gray-600",
  "Pagado": "bg-green-100 text-green-700",
  "Anulado": "bg-red-100 text-red-700",
  "En circulación": "bg-blue-100 text-blue-700",
};

// Clave estable para identificar un movimiento entre selección/servidor —
// mismo par (origen, origenId) que espera actualizarEstadoBancos.
const claveMov = (m: MovimientoBancoTotal) => `${m.origen}:${m.origenId}`;

// Ruta del Voucher según de dónde viene el cheque — compras y viáticos
// tienen cada uno su propia ruta (ambas agrupan por numero_cheque del lado
// del servidor, así que cualquier origenId del grupo llega al mismo
// Voucher combinado); Vale de Caja Chica ya tenía la suya. Depósitos/
// Reintegros no son un documento de cheque, no llevan Voucher.
function voucherHref(origen: MovimientoBancoTotal["origen"], origenId: number): string | null {
  if (origen === "compra") return `/dashboard/bancos/${origenId}/imprimir`;
  if (origen === "viatico") return `/dashboard/bancos/viatico/${origenId}/imprimir`;
  if (origen === "vale_cheque") return `/dashboard/voucher/${origenId}/imprimir`;
  return null;
}

// Agrupado por cheque, solo para esta pantalla (2026-09-20, pedido del
// cliente: "que agrupe por cheque y que sea abatible... así es más fácil
// de visualizar cuando ya hay muchos cheques hechos") — a diferencia de
// Libro Bancos (agruparPorCheque en el servidor, que sí colapsa las filas
// de una vez), acá la agrupación es puramente de presentación: cada pago
// individual sigue siendo su propia fila (origen/origenId) para que
// actualizarEstadoBancos pueda seguir marcando Pagado/Anulado/En
// Circulación pago por pago si hace falta — solo se envuelve en un
// resumen expandible cuando hay más de uno bajo el mismo número de
// cheque. Un cheque de un solo pago se sigue viendo como fila simple, sin
// acordeón de más.
type FilaRegistro =
  | { tipo: "simple"; mov: MovimientoBancoTotal; orden: number }
  | { tipo: "grupo"; numeroCheque: string; miembros: MovimientoBancoTotal[]; orden: number };

interface Props { pagos: PagoFondoRotativo[]; movimientos: MovimientoBancoTotal[]; }

export default function BancosClient({ pagos: init, movimientos: movInit }: Props) {
  const [pagos, setPagos] = useState(init);
  const [movimientos, setMovimientos] = useState(movInit);
  const [modalFor, setModalFor] = useState<PagoFondoRotativo | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [chequesExpandidos, setChequesExpandidos] = useState<Set<string>>(new Set());
  const [procesando, setProcesando] = useState<number | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});
  const [query, setQuery] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  // Estado en curso (no un simple boolean) para que el botón que realmente
  // se clickeó muestre su propio spinner — antes solo "Marcar Pagado" tenía
  // el ícono condicional, los otros 3 solo se veían deshabilitados/opacos
  // sin ningún indicio visual de que la acción estaba en curso, lo que
  // llevaba a pensar que no había pasado nada y recargar la página en vez
  // de esperar la respuesta (reportado por el cliente 2026-09-17).
  const [accionEnCurso, setAccionEnCurso] = useState<MovimientoBancoTotal["status"] | null>(null);
  const actualizandoEstado = accionEnCurso != null;
  const [errorEstado, setErrorEstado] = useState("");

  const q = query.toLowerCase().trim();
  const movimientosFiltrados = useMemo(() => !q ? movimientos : movimientos.filter(m =>
    m.descripcion.toLowerCase().includes(q) ||
    (m.beneficiario ?? "").toLowerCase().includes(q) ||
    (m.nitBeneficiario ?? "").toLowerCase().includes(q) ||
    (m.numeroCheque ?? "").toLowerCase().includes(q) ||
    m.fecha.includes(q)
  ), [movimientos, q]);
  const saldoActual = movimientos.length > 0 ? movimientos[movimientos.length - 1].saldo : null;

  // Agrupa por número de cheque (solo egresos — depósitos/reintegros nunca
  // se agrupan, ya son un solo evento cada uno) — un cheque con un solo
  // pago sigue como fila simple, sin acordeón. `orden` conserva la
  // posición del ÚLTIMO miembro dentro de movimientosFiltrados para que la
  // fila resumen quede en su lugar cronológico real (mismo criterio que
  // agruparPorCheque, del lado del servidor, para Libro Bancos).
  const filas = useMemo<FilaRegistro[]>(() => {
    const porCheque = new Map<string, MovimientoBancoTotal[]>();
    const resultado: FilaRegistro[] = [];
    movimientosFiltrados.forEach((m, i) => {
      if (m.numeroCheque && m.egresos > 0) {
        const arr = porCheque.get(m.numeroCheque) ?? [];
        arr.push(m);
        porCheque.set(m.numeroCheque, arr);
      } else {
        resultado.push({ tipo: "simple", mov: m, orden: i });
      }
    });
    for (const [numeroCheque, miembros] of porCheque) {
      if (miembros.length === 1) {
        resultado.push({ tipo: "simple", mov: miembros[0], orden: movimientosFiltrados.indexOf(miembros[0]) });
      } else {
        const orden = Math.max(...miembros.map(m => movimientosFiltrados.indexOf(m)));
        resultado.push({ tipo: "grupo", numeroCheque, miembros, orden });
      }
    }
    return resultado.sort((a, b) => a.orden - b.orden);
  }, [movimientosFiltrados]);

  function toggleSeleccion(clave: string) {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave); else next.add(clave);
      return next;
    });
  }

  function toggleSeleccionGrupo(miembros: MovimientoBancoTotal[]) {
    const claves = miembros.map(claveMov);
    const todos = claves.every(c => seleccionados.has(c));
    setSeleccionados(prev => {
      const next = new Set(prev);
      claves.forEach(c => todos ? next.delete(c) : next.add(c));
      return next;
    });
  }

  function toggleExpandidoCheque(numeroCheque: string) {
    setChequesExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(numeroCheque)) next.delete(numeroCheque); else next.add(numeroCheque);
      return next;
    });
  }

  function toggleSeleccionTodos() {
    setSeleccionados(prev =>
      movimientosFiltrados.every(m => prev.has(claveMov(m))) ? new Set() : new Set(movimientosFiltrados.map(claveMov))
    );
  }

  async function handleActualizarEstado(estado: MovimientoBancoTotal["status"]) {
    const items = movimientos.filter(m => seleccionados.has(claveMov(m))).map(m => ({ origen: m.origen, origenId: m.origenId }));
    if (items.length === 0) return;
    setAccionEnCurso(estado); setErrorEstado("");
    const res = await actualizarEstadoBancos(items, estado);
    setAccionEnCurso(null);
    if ("error" in res) { setErrorEstado(res.error); return; }
    setMovimientos(prev => prev.map(m => seleccionados.has(claveMov(m)) ? { ...m, status: estado } : m));
    setSeleccionados(new Set());
  }

  async function handleDevolver(p: PagoFondoRotativo) {
    if (!confirm("¿Devolver este pago a Fondo Rotativo/Pagos para elegir otra forma de pago? Se deshacen los datos de cheque ya capturados (y lo que ya se posteó en Ejecución)."))
      return;
    setProcesando(p.id); setRowError(prev => ({ ...prev, [p.id]: "" }));
    const res = await devolverAFormaPago(p.id);
    setProcesando(null);
    if ("error" in res) { setRowError(prev => ({ ...prev, [p.id]: res.error })); return; }
    setPagos(prev => prev.filter(x => x.id !== p.id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Landmark className="w-5 h-5" /> Fondo Rotativo — Bancos
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Registro total de la cuenta del Fondo Rotativo
          {saldoActual != null && <> · Saldo actual: <span className="font-mono font-semibold text-gray-700">{Q(saldoActual)}</span></>}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar por cheque, beneficiario, NIT, fecha…"
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {seleccionados.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-500">{seleccionados.size} seleccionado(s)</span>
            <button onClick={() => handleActualizarEstado("Pagado")} disabled={actualizandoEstado}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
              {accionEnCurso === "Pagado" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Marcar Pagado
            </button>
            <button onClick={() => handleActualizarEstado("Anulado")} disabled={actualizandoEstado}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
              {accionEnCurso === "Anulado" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Marcar Anulado
            </button>
            <button onClick={() => handleActualizarEstado("En circulación")} disabled={actualizandoEstado}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {accionEnCurso === "En circulación" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Marcar En Circulación
            </button>
            <button onClick={() => handleActualizarEstado("Operado")} disabled={actualizandoEstado}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">
              {accionEnCurso === "Operado" && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Volver a Operado
            </button>
          </div>
        )}
      </div>
      {errorEstado && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorEstado}</div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" className="rounded border-gray-300"
                    checked={movimientosFiltrados.length > 0 && movimientosFiltrados.every(m => seleccionados.has(claveMov(m)))}
                    onChange={toggleSeleccionTodos} />
                </th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Mes</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Cheque #</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Tipo Doc.</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">NIT Beneficiario</th>
                <th className="px-4 py-3 text-left">Beneficiario</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Egresos</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Ingresos</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Saldo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Total en letras</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filas.map(fila => fila.tipo === "simple"
                ? <FilaMovimiento key={fila.mov.id} m={fila.mov}
                    seleccionado={seleccionados.has(claveMov(fila.mov))} onToggleSeleccion={() => toggleSeleccion(claveMov(fila.mov))} />
                : <FilaGrupoCheque key={`chq-${fila.numeroCheque}`} numeroCheque={fila.numeroCheque} miembros={fila.miembros}
                    expandido={chequesExpandidos.has(fila.numeroCheque)} onToggleExpandido={() => toggleExpandidoCheque(fila.numeroCheque)}
                    seleccionados={seleccionados} onToggleSeleccionGrupo={() => toggleSeleccionGrupo(fila.miembros)} />
              )}
            </tbody>
          </table>
          {movimientosFiltrados.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{q ? "Sin resultados para esa búsqueda." : "Todavía no hay movimientos registrados."}</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Pendientes de completar voucher</h2>
        <p className="text-xs text-gray-500 mb-2">
          {pagos.length} pago(s) por cheque de compras. Completa el número de cheque y los datos del Voucher para poder imprimirlo.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. A-04 SIAF</th>
                <th className="px-4 py-3 text-left">Destinatario</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Factura</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Cheque</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagos.map(p => (
                <ExpandableRow key={p.id} colSpan={7}
                  expanded={expandedId === p.id}
                  onToggle={() => setExpandedId(prev => prev === p.id ? null : p.id)}
                  rowClassName="hover:bg-gray-50 cursor-pointer transition-colors"
                  detail={<TrazabilidadPanel
                    titulo={`Detalle de A-04 SIAF ${p.numero_a04 != null ? `${p.numero_a04}/${p.anio_a04}` : ""}`}
                    cadena={[
                      { label: "No. Cheque", value: p.numero_cheque },
                      { label: "NPG", value: p.npg },
                      { label: "FRI", value: p.fri_numero != null ? `${p.fri_numero}/${p.fri_anio}` : null },
                    ]}
                    traz={p.traz}
                  />}>
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                    {p.numero_a04 != null ? `${p.numero_a04}/${p.anio_a04}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.destinatario_nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {p.serie_factura}-{p.no_factura} · {p.fecha_emision_factura}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{p.numero_cheque ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                    {p.total != null ? Q(p.total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => handleDevolver(p)} disabled={procesando === p.id}
                        title="Devolver a Fondo Rotativo/Pagos para elegir otra forma de pago"
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50">
                        {procesando === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                      </button>
                      {p.numero_cheque == null ? (
                        <button onClick={() => setModalFor(p)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                          <FileEdit className="w-3 h-3" /> Completar datos
                        </button>
                      ) : (
                        <>
                          <button onClick={() => setModalFor(p)}
                            title="Corregir datos"
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                            <FileEdit className="w-4 h-4" />
                          </button>
                          <Link href={`/dashboard/bancos/${p.id}/imprimir`}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                            <Printer className="w-3 h-3" /> Imprimir Voucher
                          </Link>
                        </>
                      )}
                    </div>
                    {rowError[p.id] && <p className="text-[10px] text-red-600 mt-1 max-w-[180px] text-right ml-auto">{rowError[p.id]}</p>}
                  </td>
                </ExpandableRow>
              ))}
            </tbody>
          </table>
          {pagos.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay pagos con cheque enviados a Bancos todavía.</p>
            </div>
          )}
        </div>
      </div>

      {modalFor && (
        <CompletarVoucherModal
          pago={modalFor}
          onClose={() => setModalFor(null)}
          onDone={(pagoActualizado) => {
            setPagos(p => p.map(x => x.id === pagoActualizado.id ? pagoActualizado : x));
            setModalFor(null);
          }}
        />
      )}
    </div>
  );
}

// Fila plana de siempre (movimiento suelto, o cheque de un solo pago) —
// lleva una primera celda vacía para alinearse con la columna del chevron
// que sí usan las filas de grupo (FilaGrupoCheque, abajo).
function FilaMovimiento({ m, seleccionado, onToggleSeleccion }: {
  m: MovimientoBancoTotal; seleccionado: boolean; onToggleSeleccion: () => void;
}) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3"></td>
      <td className="px-4 py-3">
        <input type="checkbox" className="rounded border-gray-300" checked={seleccionado} onChange={onToggleSeleccion} />
      </td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{m.mes || "—"}</td>
      <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">
        {m.numeroCheque ?? "—"}
        {voucherHref(m.origen, m.origenId) && (
          <Link href={voucherHref(m.origen, m.origenId)!} onClick={e => e.stopPropagation()} title="Imprimir Voucher"
            className="ml-2 inline-flex align-middle text-gray-400 hover:text-brand-600">
            <Printer className="w-3.5 h-3.5" />
          </Link>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TIPO_DOC_COLOR[m.tipoDocumento]}`}>{m.tipoDocumento}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[m.status]}`}>{m.status}</span>
      </td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{m.fecha || "—"}</td>
      <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{m.nitBeneficiario ?? "—"}</td>
      <td className="px-4 py-3 text-gray-900">{m.beneficiario ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{m.descripcion}</td>
      <td className="px-4 py-3 text-right font-mono text-red-700 whitespace-nowrap">{m.egresos > 0 ? Q(m.egresos) : "—"}</td>
      <td className="px-4 py-3 text-right font-mono text-green-700 whitespace-nowrap">{m.ingresos > 0 ? Q(m.ingresos) : "—"}</td>
      <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap">{Q(m.saldo)}</td>
      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{m.totalEnLetras}</td>
    </tr>
  );
}

// Fila resumen de un cheque que cubre varios pagos, con el detalle
// abatible (pedido del cliente 2026-09-20) — la selección/checkbox de la
// fila resumen actúa sobre TODOS los miembros a la vez (un cheque físico
// se cobra o se anula como un solo evento), pero cada miembro sigue
// existiendo como su propia fila del lado del servidor
// (registro_bancos_estado por origen/origenId) — no se pierde la
// granularidad, solo se colapsa visualmente.
function FilaGrupoCheque({ numeroCheque, miembros, expandido, onToggleExpandido, seleccionados, onToggleSeleccionGrupo }: {
  numeroCheque: string; miembros: MovimientoBancoTotal[];
  expandido: boolean; onToggleExpandido: () => void;
  seleccionados: Set<string>; onToggleSeleccionGrupo: () => void;
}) {
  const ultimo = miembros[miembros.length - 1];
  const egresoTotal = miembros.reduce((s, m) => s + m.egresos, 0);
  const beneficiarios = [...new Set(miembros.map(m => m.beneficiario).filter((x): x is string => !!x))];
  const nits = [...new Set(miembros.map(m => m.nitBeneficiario).filter((x): x is string => !!x))];
  const tiposDoc = [...new Set(miembros.map(m => m.tipoDocumento))];
  const estados = [...new Set(miembros.map(m => m.status))];
  const tipoUnico = tiposDoc.length === 1 ? tiposDoc[0] : null;
  const estadoUnico = estados.length === 1 ? estados[0] : null;
  const todosSeleccionados = miembros.every(m => seleccionados.has(claveMov(m)));

  return (
    <ExpandableRow colSpan={14} expanded={expandido} onToggle={onToggleExpandido}
      rowClassName="hover:bg-gray-50 cursor-pointer transition-colors"
      detail={
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500">
              <th className="text-left py-1 pr-3">Descripción</th>
              <th className="text-left py-1 pr-3">Fecha</th>
              <th className="text-left py-1 pr-3">Status</th>
              <th className="text-right py-1">Egresos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {miembros.map(m => (
              <tr key={claveMov(m)}>
                <td className="py-1.5 pr-3 text-gray-700">{m.descripcion}</td>
                <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{m.fecha || "—"}</td>
                <td className="py-1.5 pr-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLOR[m.status]}`}>{m.status}</span>
                </td>
                <td className="py-1.5 text-right font-mono text-red-700 whitespace-nowrap">{Q(m.egresos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }>
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <input type="checkbox" className="rounded border-gray-300" checked={todosSeleccionados} onChange={onToggleSeleccionGrupo} />
      </td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{ultimo.mes || "—"}</td>
      <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">
        {numeroCheque}
        {voucherHref(ultimo.origen, ultimo.origenId) && (
          <Link href={voucherHref(ultimo.origen, ultimo.origenId)!} onClick={e => e.stopPropagation()} title="Imprimir Voucher"
            className="ml-2 inline-flex align-middle text-gray-400 hover:text-brand-600">
            <Printer className="w-3.5 h-3.5" />
          </Link>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {tipoUnico ? (
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TIPO_DOC_COLOR[tipoUnico]}`}>{tipoUnico}</span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700" title={tiposDoc.join(", ")}>Mixto</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {estadoUnico ? (
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[estadoUnico]}`}>{estadoUnico}</span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700" title={estados.join(", ")}>Mixto</span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{ultimo.fecha || "—"}</td>
      <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{nits.join(" / ") || "—"}</td>
      <td className="px-4 py-3 text-gray-900">{beneficiarios.join(" / ") || "—"}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{miembros.length} pagos con este cheque</td>
      <td className="px-4 py-3 text-right font-mono font-bold text-red-700 whitespace-nowrap">{Q(egresoTotal)}</td>
      <td className="px-4 py-3 text-right font-mono text-green-700 whitespace-nowrap">—</td>
      <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap">{Q(ultimo.saldo)}</td>
      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{montoEnLetras(egresoTotal)}</td>
    </ExpandableRow>
  );
}

function CompletarVoucherModal({ pago: p, onClose, onDone }: {
  pago: PagoFondoRotativo; onClose: () => void; onDone: (pago: PagoFondoRotativo) => void;
}) {
  const [numeroCheque, setNumeroCheque] = useState(p.numero_cheque ?? "");
  const [fechaEmisionCheque, setFechaEmisionCheque] = useState(p.fecha_emision_cheque ?? fechaGuatemala());
  const [tipoDocumentoPago, setTipoDocumentoPago] = useState<TipoDocumentoPago | "">(p.tipo_documento_pago as TipoDocumentoPago ?? "Factura");
  const [nitBeneficiario, setNitBeneficiario] = useState(p.nit_beneficiario ?? "");
  const [destinatarioNombre, setDestinatarioNombre] = useState(p.destinatario_nombre ?? "");
  const [montoCheque, setMontoCheque] = useState(String(p.monto_cheque ?? p.total ?? ""));
  const [montoLetras, setMontoLetras] = useState(p.monto_letras ?? (p.total ? montoEnLetras(p.total) : ""));
  const [conceptoVoucher, setConceptoVoucher] = useState(p.concepto_voucher ?? `A-04 No. ${p.numero_a04 ?? ""}/${p.anio_a04 ?? ""}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function onMontoChange(v: string) {
    setMontoCheque(v);
    const n = Number(v);
    if (n > 0) setMontoLetras(montoEnLetras(n));
  }

  async function handleGuardar() {
    const monto = Number(montoCheque);
    setLoading(true); setError("");
    const res = await completarVoucherBancos(p.id, {
      numero_cheque: numeroCheque.trim(), fecha_emision_cheque: fechaEmisionCheque,
      tipo_documento_pago: tipoDocumentoPago as TipoDocumentoPago,
      nit_beneficiario: nitBeneficiario.trim(), destinatario_nombre: destinatarioNombre.trim(),
      monto_cheque: monto, monto_letras: montoLetras.trim(), concepto_voucher: conceptoVoucher.trim(),
    });
    setLoading(false);
    if ("error" in res) { setError(res.error); return; }
    onDone({
      ...p,
      numero_cheque: numeroCheque.trim(), fecha_emision_cheque: fechaEmisionCheque,
      tipo_documento_pago: tipoDocumentoPago, nit_beneficiario: nitBeneficiario.trim(),
      destinatario_nombre: destinatarioNombre.trim(), monto_cheque: monto,
      monto_letras: montoLetras.trim(), concepto_voucher: conceptoVoucher.trim(),
    });
  }

  const valido = numeroCheque.trim() && fechaEmisionCheque && tipoDocumentoPago
    && nitBeneficiario.trim() && destinatarioNombre.trim() && Number(montoCheque) > 0 && montoLetras.trim();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-brand-600" /> Completar cheque y Voucher
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 grid grid-cols-2 gap-3">
          <div>
            <label className="label">No. de cheque</label>
            <input className="input font-mono" value={numeroCheque} onChange={e => setNumeroCheque(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Fecha de emisión</label>
            <input type="date" className="input" value={fechaEmisionCheque} onChange={e => setFechaEmisionCheque(e.target.value)} />
          </div>
          <div>
            <label className="label">Tipo de documento</label>
            <select className="input" value={tipoDocumentoPago} onChange={e => setTipoDocumentoPago(e.target.value as TipoDocumentoPago)}>
              <option value="Factura">Factura</option>
              <option value="Vale">Vale</option>
              <option value="Formulario">Formulario</option>
            </select>
          </div>
          <div>
            <label className="label">NIT del beneficiario</label>
            <NitAutocomplete
              value={nitBeneficiario}
              onChange={setNitBeneficiario}
              onSelect={prov => {
                setNitBeneficiario(prov.nit ?? nitBeneficiario);
                setDestinatarioNombre(prov.nombre);
              }}
            />
          </div>
          <div className="col-span-2">
            <label className="label">Nombre del beneficiario</label>
            <input className="input" value={destinatarioNombre} onChange={e => setDestinatarioNombre(e.target.value)} />
          </div>
          <div>
            <label className="label">Monto (Q)</label>
            <input type="number" step="0.01" className="input font-mono" value={montoCheque} onChange={e => onMontoChange(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Cantidad (en letras)</label>
            <input className="input" value={montoLetras} onChange={e => setMontoLetras(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Concepto (Voucher)</label>
            <input className="input" value={conceptoVoucher} onChange={e => setConceptoVoucher(e.target.value)} />
          </div>
          {error && (
            <div className="col-span-2 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleGuardar} disabled={loading || !valido} className="btn-primary disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
