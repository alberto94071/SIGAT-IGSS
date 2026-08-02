"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CheckCircle, XCircle, ArrowRightLeft, Printer } from "lucide-react";
import { CUATRIMESTRES, TIPOS_MODIFICACION, type TipoModificacion } from "@/lib/programacion-constants";
import {
  buscarRenglones, getSubproductosDeRenglon, getSubproductosConDisponible,
  guardarModificacion, getModificaciones, aprobarModificacion, rechazarModificacion,
  transferirPresupuesto, getTransferencias, aprobarTransferencia, rechazarTransferencia,
  type SubproductoDisponible, type SubproductoConDisponible,
  type ModificacionRow, type TransferenciaRow,
} from "@/lib/programacion-actions";

function badgeEstado(estado: string) {
  const clases: Record<string, string> = {
    Solicitado: "bg-amber-100 text-amber-700",
    Aprobado: "bg-green-100 text-green-700",
    Rechazado: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${clases[estado] ?? "bg-gray-100 text-gray-700"}`}>
      {estado}
    </span>
  );
}

const Q = (n: number) =>
  `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type FilaModificacion = {
  subProducto: string;
  descripcion: string;
  vigente: number;
  valor: string;
  guardando: boolean;
  error: string | null;
  ok: boolean;
};

export default function ModificacionesClient() {
  const [tipoModificacion, setTipoModificacion] = useState<TipoModificacion | "transferencia" | null>(null);
  const [cuatrimestre, setCuatrimestre] = useState<number | null>(null);

  const [modificaciones, setModificaciones] = useState<ModificacionRow[]>([]);

  const [renglonQuery, setRenglonQuery] = useState("");
  const [sugerencias, setSugerencias] = useState<SubproductoDisponible[]>([]);
  const [renglonSeleccionado, setRenglonSeleccionado] = useState<number | null>(null);
  const [filasModificacion, setFilasModificacion] = useState<FilaModificacion[]>([]);

  const [accionesModificacion, setAccionesModificacion] = useState<Record<number, { cargando: boolean; error: string | null }>>({});

  const recargarModificaciones = useCallback(() => {
    getModificaciones().then(setModificaciones);
  }, []);

  const ejecutarAccionModificacion = async (id: number, accion: (id: number) => Promise<{ ok: true } | { error: string }>) => {
    setAccionesModificacion(prev => ({ ...prev, [id]: { cargando: true, error: null } }));
    const res = await accion(id);
    if ("error" in res) {
      setAccionesModificacion(prev => ({ ...prev, [id]: { cargando: false, error: res.error } }));
    } else {
      setAccionesModificacion(prev => ({ ...prev, [id]: { cargando: false, error: null } }));
      recargarModificaciones();
    }
  };

  useEffect(() => {
    if (tipoModificacion !== null && tipoModificacion !== "transferencia") recargarModificaciones();
  }, [tipoModificacion, recargarModificaciones]);

  useEffect(() => {
    if (renglonQuery.trim() === "") { setSugerencias([]); return; }
    const t = setTimeout(() => {
      buscarRenglones(renglonQuery).then(rows => {
        const unicos = Array.from(new Map(rows.map(r => [r.renglon, r])).values());
        setSugerencias(unicos);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [renglonQuery]);

  const seleccionarRenglon = useCallback((renglon: number) => {
    setRenglonSeleccionado(renglon);
    setRenglonQuery("");
    setSugerencias([]);
    getSubproductosDeRenglon(renglon).then(subs => {
      setFilasModificacion(subs.map(s => ({
        subProducto: s.subProducto,
        descripcion: s.descripcion,
        vigente: s.vigente,
        valor: "",
        guardando: false, error: null, ok: false,
      })));
    });
  }, []);

  const actualizarFilaModificacion = (idx: number, patch: Partial<FilaModificacion>) => {
    setFilasModificacion(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };

  const guardarFilaModificacion = async (idx: number) => {
    if (renglonSeleccionado === null || !tipoModificacion || tipoModificacion === "transferencia") return;
    const fila = filasModificacion[idx];
    actualizarFilaModificacion(idx, { guardando: true, error: null, ok: false });
    const res = await guardarModificacion({
      tipo: tipoModificacion,
      renglon: renglonSeleccionado,
      subProducto: fila.subProducto,
      valor: Number(fila.valor) || 0,
    });
    if ("error" in res) {
      actualizarFilaModificacion(idx, { guardando: false, error: res.error });
    } else {
      actualizarFilaModificacion(idx, { guardando: false, ok: true, error: null });
      recargarModificaciones();
    }
  };

  const cuatrimestreInfo = cuatrimestre !== null ? CUATRIMESTRES.find(c => c.id === cuatrimestre)! : null;
  const tipoModificacionInfo = tipoModificacion !== null && tipoModificacion !== "transferencia"
    ? TIPOS_MODIFICACION.find(t => t.id === tipoModificacion)!
    : null;

  // ── Paso 1: elegir tipo de modificación ──
  if (tipoModificacion === null) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modificaciones</h1>
            <p className="text-gray-500 mt-2">Registra una modificación presupuestaria (Ingru, entre renglones o ampliación).</p>
          </div>
          <Link
            href="/presupuesto/modificaciones/imprimir"
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 whitespace-nowrap mt-1"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TIPOS_MODIFICACION.map(t => (
            <button
              key={t.id}
              onClick={() => setTipoModificacion(t.id)}
              className="bg-white border-2 border-gray-200 hover:border-amber-500 rounded-xl p-5 text-left shadow-sm transition-colors"
            >
              <div className="font-bold text-gray-900">{t.label}</div>
            </button>
          ))}
          <button
            onClick={() => setTipoModificacion("transferencia")}
            className="bg-white border-2 border-gray-200 hover:border-amber-500 rounded-xl p-5 text-left shadow-sm transition-colors"
          >
            <ArrowRightLeft className="w-5 h-5 text-amber-600 mb-2" />
            <div className="font-bold text-gray-900">Transferencia entre renglón/sub-producto</div>
            <p className="text-xs text-gray-500 mt-1">Quita presupuesto disponible de un renglón/sub-producto y se lo asigna a otro.</p>
          </button>
        </div>
      </div>
    );
  }

  // ── Transferencia real (no pasa por "elegir cuatrimestre": mueve presupuesto del año completo) ──
  if (tipoModificacion === "transferencia") {
    return <TransferenciaView onVolver={() => setTipoModificacion(null)} />;
  }

  // ── Paso: elegir cuatrimestre ──
  if (cuatrimestre === null) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => setTipoModificacion(null)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{tipoModificacionInfo!.label} — Elige el cuatrimestre</h1>
          <p className="text-sm text-gray-500 mt-1">Así están conformados los cuatrimestres del ejercicio fiscal:</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CUATRIMESTRES.map(c => (
            <button
              key={c.id}
              onClick={() => setCuatrimestre(c.id)}
              className="bg-white border-2 border-gray-200 hover:border-brand-500 rounded-xl p-5 text-left shadow-sm transition-colors"
            >
              <div className="text-xs font-semibold text-brand-600 uppercase tracking-wide">Cuatrimestre {c.id}</div>
              <div className="font-bold text-gray-900 mt-1">{c.label}</div>
              <div className="text-xs text-gray-500 mt-2">{c.meses.join(" · ")}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const volverAlMenu = () => {
    setTipoModificacion(null);
    setCuatrimestre(null);
    setRenglonSeleccionado(null);
    setFilasModificacion([]);
  };

  // ── Paso final: buscar renglón, ver sub-productos y fijar el valor de la modificación ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={volverAlMenu} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-1">
            <ArrowLeft className="w-4 h-4" /> Volver al menú
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {tipoModificacionInfo!.label} — Cuatrimestre {cuatrimestre}: {cuatrimestreInfo!.label}
          </h1>
        </div>
        <button
          onClick={() => setCuatrimestre(null)}
          className="text-sm text-brand-600 hover:text-brand-700 underline"
        >
          Cambiar cuatrimestre
        </button>
      </div>

      {/* ── Buscar renglón ── */}
      <div className="relative max-w-sm">
        <label className="text-sm text-gray-600 font-medium block mb-1">Buscar renglón:</label>
        <input
          type="text"
          inputMode="numeric"
          value={renglonQuery}
          onChange={e => setRenglonQuery(e.target.value.replace(/\D/g, ""))}
          placeholder="Ej. 182"
          className="input w-full rounded-lg"
        />
        {sugerencias.length > 0 && (
          <div className="absolute z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 w-full max-h-64 overflow-y-auto">
            {sugerencias.map(s => (
              <button
                key={s.renglon}
                onClick={() => seleccionarRenglon(s.renglon)}
                className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
              >
                <span className="font-semibold text-gray-900">{s.renglon}</span>
                <span className="text-gray-500"> — {s.descripcion}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {renglonSeleccionado !== null && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Sub-Producto</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Vigente</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 w-40">{tipoModificacionInfo!.label}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filasModificacion.map((f, idx) => (
                  <tr key={f.subProducto} className="border-b border-gray-100">
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs text-gray-700">{f.subProducto}</div>
                      <div className="text-xs text-gray-400 truncate max-w-[220px]">{f.descripcion}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{Q(f.vigente)}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={f.valor}
                        onChange={e => actualizarFilaModificacion(idx, { valor: e.target.value, ok: false, error: null })}
                        className="input py-1 text-xs rounded-lg w-full text-right"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => guardarFilaModificacion(idx)}
                        disabled={f.guardando}
                        className="btn-primary py-1 px-3 text-xs rounded-lg disabled:opacity-50"
                      >
                        {f.guardando ? "Guardando…" : "Guardar"}
                      </button>
                      {f.ok && (
                        <div className="flex items-center gap-1 text-green-600 text-xs mt-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Guardado
                        </div>
                      )}
                      {f.error && <p className="text-red-600 text-xs mt-1 max-w-[220px]">{f.error}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tabla de renglones ya modificados (solo del tipo actual) ── */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-gray-900">{tipoModificacionInfo!.label} registradas</h2>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Renglón</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Descripción</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Sub-Producto</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Valor</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Estado</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {modificaciones.filter(m => m.tipo === tipoModificacion).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                      Aún no hay {tipoModificacionInfo!.label.toLowerCase()} registradas.
                    </td>
                  </tr>
                ) : (
                  modificaciones.filter(m => m.tipo === tipoModificacion).map(m => {
                    const a = accionesModificacion[m.id];
                    const esSolicitado = m.estado === "Solicitado";
                    return (
                      <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-semibold text-gray-900">{m.renglon}</td>
                        <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate">{m.descripcion}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{m.subProducto}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{Q(m.valor)}</td>
                        <td className="px-3 py-2">{badgeEstado(m.estado)}</td>
                        <td className="px-3 py-2">
                          {esSolicitado && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => ejecutarAccionModificacion(m.id, aprobarModificacion)}
                                disabled={a?.cargando}
                                title="Aprobar"
                                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-50"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => ejecutarAccionModificacion(m.id, rechazarModificacion)}
                                disabled={a?.cargando}
                                title="Rechazar"
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          {a?.error && <p className="text-red-600 text-xs mt-1 max-w-[180px]">{a.error}</p>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

type SeleccionRenglon = { renglon: number; subProducto: string; descripcion: string; disponible: number };

// Buscador de renglón + selector de sub-producto (con su presupuesto
// disponible), reutilizado para elegir tanto el origen como el destino de
// una transferencia.
function RenglonSubproductoPicker({ label, value, onChange }: {
  label: string;
  value: SeleccionRenglon | null;
  onChange: (v: SeleccionRenglon | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [sugerencias, setSugerencias] = useState<SubproductoDisponible[]>([]);
  const [renglonSel, setRenglonSel] = useState<number | null>(null);
  const [subs, setSubs] = useState<SubproductoConDisponible[]>([]);

  useEffect(() => {
    if (query.trim() === "") { setSugerencias([]); return; }
    const t = setTimeout(() => {
      buscarRenglones(query).then(rows => {
        const unicos = Array.from(new Map(rows.map(r => [r.renglon, r])).values());
        setSugerencias(unicos);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  function elegirRenglon(renglon: number) {
    setRenglonSel(renglon);
    setQuery(""); setSugerencias([]);
    onChange(null);
    getSubproductosConDisponible(renglon).then(setSubs);
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <div className="relative">
        <input
          type="text" inputMode="numeric"
          value={query}
          onChange={e => setQuery(e.target.value.replace(/\D/g, ""))}
          placeholder="Buscar renglón… ej. 182"
          className="input w-full rounded-lg"
        />
        {sugerencias.length > 0 && (
          <div className="absolute z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 w-full max-h-64 overflow-y-auto">
            {sugerencias.map(s => (
              <button
                key={s.renglon}
                onClick={() => elegirRenglon(s.renglon)}
                className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
              >
                <span className="font-semibold text-gray-900">{s.renglon}</span>
                <span className="text-gray-500"> — {s.descripcion}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {renglonSel !== null && (
        <select
          className="input w-full rounded-lg text-sm"
          value={value?.subProducto ?? ""}
          onChange={e => {
            const s = subs.find(s => s.subProducto === e.target.value);
            if (s) onChange({ renglon: renglonSel, subProducto: s.subProducto, descripcion: s.descripcion, disponible: s.disponible });
            else onChange(null);
          }}
        >
          <option value="">Elige sub-producto…</option>
          {subs.map(s => (
            <option key={s.subProducto} value={s.subProducto}>
              {s.subProducto} — {s.descripcion} (disponible: {Q(s.disponible)})
            </option>
          ))}
        </select>
      )}
      {value && (
        <p className="text-xs text-gray-500">
          Renglón <strong>{value.renglon}</strong> / <span className="font-mono">{value.subProducto}</span> — disponible:{" "}
          <strong className={value.disponible > 0 ? "text-green-700" : "text-red-600"}>{Q(value.disponible)}</strong>
        </p>
      )}
    </div>
  );
}

function TransferenciaView({ onVolver }: { onVolver: () => void }) {
  const [origen, setOrigen] = useState<SeleccionRenglon | null>(null);
  const [destino, setDestino] = useState<SeleccionRenglon | null>(null);
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [historial, setHistorial] = useState<TransferenciaRow[]>([]);
  const [accionesTransferencia, setAccionesTransferencia] = useState<Record<number, { cargando: boolean; error: string | null }>>({});

  const recargarHistorial = useCallback(() => { getTransferencias().then(setHistorial); }, []);
  useEffect(() => { recargarHistorial(); }, [recargarHistorial]);

  const ejecutarAccionTransferencia = async (id: number, accion: (id: number) => Promise<{ ok: true } | { error: string }>) => {
    setAccionesTransferencia(prev => ({ ...prev, [id]: { cargando: true, error: null } }));
    const res = await accion(id);
    if ("error" in res) {
      setAccionesTransferencia(prev => ({ ...prev, [id]: { cargando: false, error: res.error } }));
    } else {
      setAccionesTransferencia(prev => ({ ...prev, [id]: { cargando: false, error: null } }));
      recargarHistorial();
    }
  };

  async function confirmar() {
    if (!origen || !destino) return setError("Elige el renglón/sub-producto de origen y de destino");
    const montoNum = Number(monto) || 0;
    if (!(montoNum > 0)) return setError("Ingresa un monto válido");
    setGuardando(true); setError(""); setOk(false);
    const res = await transferirPresupuesto({
      renglonOrigen: origen.renglon, subProductoOrigen: origen.subProducto,
      renglonDestino: destino.renglon, subProductoDestino: destino.subProducto,
      monto: montoNum, motivo: motivo.trim() || undefined,
    });
    setGuardando(false);
    if ("error" in res) { setError(res.error); return; }
    setOk(true);
    setOrigen(null); setDestino(null); setMonto(""); setMotivo("");
    recargarHistorial();
  }

  return (
    <div className="space-y-6">
      <div>
        <button onClick={onVolver} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-1">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <h1 className="text-xl font-bold text-gray-900">Transferencia entre renglón/sub-producto</h1>
        <p className="text-sm text-gray-500 mt-1">
          Quita presupuesto disponible del origen y se lo asigna al destino. No se puede transferir más de lo disponible en el origen.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RenglonSubproductoPicker label="Origen (de dónde se quita)" value={origen} onChange={setOrigen} />
          <RenglonSubproductoPicker label="Destino (a dónde se asigna)" value={destino} onChange={setDestino} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Monto a transferir</label>
            <input
              type="number" min={0} step="0.01"
              value={monto} onChange={e => setMonto(e.target.value)}
              placeholder="0.00"
              className="input w-full rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Motivo (opcional)</label>
            <input
              type="text" value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ej. faltante para completar compra de rayos X"
              className="input w-full rounded-lg"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {ok && (
          <div className="flex items-center gap-1.5 text-green-700 text-sm">
            <CheckCircle2 className="w-4 h-4" /> Transferencia registrada.
          </div>
        )}

        <button
          onClick={confirmar}
          disabled={guardando || !origen || !destino}
          className="btn-primary rounded-lg disabled:opacity-50"
        >
          {guardando ? "Transfiriendo…" : "Transferir"}
        </button>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-bold text-gray-900">Transferencias registradas</h2>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Fecha</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Origen</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Destino</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Monto</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Motivo</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Estado</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {historial.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Aún no hay transferencias registradas.</td></tr>
                ) : (
                  historial.map(t => {
                    const a = accionesTransferencia[t.id];
                    const esSolicitado = t.estado === "Solicitado";
                    return (
                      <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{t.fecha}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-700">{t.renglonOrigen} / {t.subProductoOrigen}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-700">{t.renglonDestino} / {t.subProductoDestino}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">{Q(t.monto)}</td>
                        <td className="px-3 py-2 text-gray-600 max-w-[240px] truncate">{t.motivo ?? "—"}</td>
                        <td className="px-3 py-2">{badgeEstado(t.estado)}</td>
                        <td className="px-3 py-2">
                          {esSolicitado && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => ejecutarAccionTransferencia(t.id, aprobarTransferencia)}
                                disabled={a?.cargando}
                                title="Aprobar"
                                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-50"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => ejecutarAccionTransferencia(t.id, rechazarTransferencia)}
                                disabled={a?.cargando}
                                title="Rechazar"
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          {a?.error && <p className="text-red-600 text-xs mt-1 max-w-[180px]">{a.error}</p>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
