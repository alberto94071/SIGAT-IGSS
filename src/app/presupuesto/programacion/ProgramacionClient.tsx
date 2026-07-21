"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, CheckCircle2, ClipboardList, RefreshCw } from "lucide-react";
import { CUATRIMESTRES, TIPOS_MODIFICACION, type TipoModificacion } from "@/lib/programacion-constants";
import {
  buscarRenglones, getSubproductosDeRenglon, getGrupos, getProgramadoDelGrupo,
  getEntradas, guardarEntrada, guardarModificacion, getModificaciones,
  type SubproductoDisponible, type GrupoConTotales, type ProgramacionEntrada, type ModificacionRow,
} from "@/lib/programacion-actions";

const Q = (n: number) =>
  `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Modo = "programacion" | "reprogramacion";

type FilaEdicion = {
  subProducto: string;
  descripcion: string;
  vigente: number;
  tipo: "normal" | "regularizado";
  mes1: string;
  mes2: string;
  mes3: string;
  mes4: string;
  guardando: boolean;
  error: string | null;
  ok: boolean;
};

type FilaModificacion = {
  subProducto: string;
  descripcion: string;
  vigente: number;
  valor: string;
  guardando: boolean;
  error: string | null;
  ok: boolean;
};

export default function ProgramacionClient() {
  const [modo, setModo] = useState<Modo | null>(null);
  const [tipoModificacion, setTipoModificacion] = useState<TipoModificacion | null>(null);
  const [cuatrimestre, setCuatrimestre] = useState<number | null>(null);

  const [grupos, setGrupos] = useState<GrupoConTotales[]>([]);
  const [entradas, setEntradas] = useState<ProgramacionEntrada[]>([]);
  const [programadoPorGrupo, setProgramadoPorGrupo] = useState<Record<number, number>>({});
  const [modificaciones, setModificaciones] = useState<ModificacionRow[]>([]);

  const [renglonQuery, setRenglonQuery] = useState("");
  const [sugerencias, setSugerencias] = useState<SubproductoDisponible[]>([]);
  const [renglonSeleccionado, setRenglonSeleccionado] = useState<number | null>(null);
  const [filas, setFilas] = useState<FilaEdicion[]>([]);
  const [filasModificacion, setFilasModificacion] = useState<FilaModificacion[]>([]);

  useEffect(() => { getGrupos().then(setGrupos); }, []);

  const recargarModificaciones = useCallback(() => {
    getModificaciones().then(setModificaciones);
  }, []);

  useEffect(() => {
    if (modo === "reprogramacion" && tipoModificacion !== null) recargarModificaciones();
  }, [modo, tipoModificacion, recargarModificaciones]);

  const recargarCuatrimestre = useCallback((c: number, gruposActuales: GrupoConTotales[]) => {
    getEntradas(c).then(setEntradas);
    Promise.all(gruposActuales.map(g => getProgramadoDelGrupo(c, g.id))).then(vals => {
      const mapa: Record<number, number> = {};
      gruposActuales.forEach((g, i) => { mapa[g.id] = vals[i]; });
      setProgramadoPorGrupo(mapa);
    });
  }, []);

  useEffect(() => {
    if (modo === "programacion" && cuatrimestre !== null && grupos.length > 0) {
      recargarCuatrimestre(cuatrimestre, grupos);
    }
  }, [modo, cuatrimestre, grupos, recargarCuatrimestre]);

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

  const seleccionarRenglon = useCallback((renglon: number, modoActual: Modo) => {
    setRenglonSeleccionado(renglon);
    setRenglonQuery("");
    setSugerencias([]);
    getSubproductosDeRenglon(renglon).then(subs => {
      if (modoActual === "programacion") {
        setFilas(subs.map(s => ({
          subProducto: s.subProducto,
          descripcion: s.descripcion,
          vigente: s.vigente,
          tipo: "normal",
          mes1: "", mes2: "", mes3: "", mes4: "",
          guardando: false, error: null, ok: false,
        })));
      } else {
        setFilasModificacion(subs.map(s => ({
          subProducto: s.subProducto,
          descripcion: s.descripcion,
          vigente: s.vigente,
          valor: "",
          guardando: false, error: null, ok: false,
        })));
      }
    });
  }, []);

  const grupoActivo = useMemo(() => {
    if (renglonSeleccionado === null) return null;
    return grupos.find(g => renglonSeleccionado >= g.min && renglonSeleccionado <= g.max) ?? null;
  }, [renglonSeleccionado, grupos]);

  const tope = grupoActivo ? grupoActivo.totalVigente / 3 : 0;
  const yaProgramado = grupoActivo ? (programadoPorGrupo[grupoActivo.id] ?? 0) : 0;
  const disponible = Math.max(0, tope - yaProgramado);

  const actualizarFila = (idx: number, patch: Partial<FilaEdicion>) => {
    setFilas(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };

  const actualizarFilaModificacion = (idx: number, patch: Partial<FilaModificacion>) => {
    setFilasModificacion(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };

  const guardarFila = async (idx: number) => {
    if (cuatrimestre === null || renglonSeleccionado === null || modo !== "programacion") return;
    const fila = filas[idx];
    actualizarFila(idx, { guardando: true, error: null, ok: false });
    const res = await guardarEntrada({
      cuatrimestre,
      renglon: renglonSeleccionado,
      subProducto: fila.subProducto,
      tipo: fila.tipo,
      mes1: Number(fila.mes1) || 0,
      mes2: Number(fila.mes2) || 0,
      mes3: Number(fila.mes3) || 0,
      mes4: Number(fila.mes4) || 0,
      modo: "programacion",
    });
    if ("error" in res) {
      actualizarFila(idx, { guardando: false, error: res.error });
    } else {
      actualizarFila(idx, { guardando: false, ok: true, error: null });
      recargarCuatrimestre(cuatrimestre, grupos);
    }
  };

  const guardarFilaModificacion = async (idx: number) => {
    if (renglonSeleccionado === null || !tipoModificacion) return;
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
  const tipoModificacionInfo = tipoModificacion !== null ? TIPOS_MODIFICACION.find(t => t.id === tipoModificacion)! : null;

  // ── Paso 1: elegir Programación o Reprogramación ──
  if (modo === null) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programación y Reprogramación</h1>
          <p className="text-gray-500 mt-2">
            Designa en qué mes y de qué forma se va a usar el dinero de cada renglón.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-5">
          <button
            onClick={() => setModo("programacion")}
            className="flex-1 sm:max-w-xs bg-white border-2 border-brand-200 hover:border-brand-500 rounded-2xl p-8 shadow-sm transition-colors text-left"
          >
            <ClipboardList className="w-8 h-8 text-brand-600 mb-3" />
            <h2 className="text-lg font-bold text-gray-900">Programación</h2>
            <p className="text-sm text-gray-500 mt-1">Asignar por primera vez el monto de un renglón para un cuatrimestre.</p>
          </button>
          <button
            onClick={() => setModo("reprogramacion")}
            className="flex-1 sm:max-w-xs bg-white border-2 border-amber-200 hover:border-amber-500 rounded-2xl p-8 shadow-sm transition-colors text-left"
          >
            <RefreshCw className="w-8 h-8 text-amber-600 mb-3" />
            <h2 className="text-lg font-bold text-gray-900">Reprogramación</h2>
            <p className="text-sm text-gray-500 mt-1">Registrar una modificación presupuestaria (Ingru, entre renglones o ampliación).</p>
          </button>
        </div>
      </div>
    );
  }

  // ── Reprogramación · Paso 1: elegir tipo de modificación ──
  if (modo === "reprogramacion" && tipoModificacion === null) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => setModo(null)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reprogramación — Elige el tipo de modificación</h1>
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
        </div>
      </div>
    );
  }

  // ── Paso: elegir cuatrimestre (ambos modos) ──
  if (cuatrimestre === null) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => modo === "reprogramacion" ? setTipoModificacion(null) : setModo(null)}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {modo === "programacion" ? "Programación" : tipoModificacionInfo!.label} — Elige el cuatrimestre
          </h1>
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

  // ── Volver al menú principal (reinicia todo) ──
  const volverAlMenu = () => {
    setModo(null);
    setTipoModificacion(null);
    setCuatrimestre(null);
    setRenglonSeleccionado(null);
    setFilas([]);
    setFilasModificacion([]);
  };

  // ── Paso final · Programación: buscar renglón, ver sub-productos y programar por mes ──
  if (modo === "programacion") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <button onClick={volverAlMenu} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-1">
              <ArrowLeft className="w-4 h-4" /> Volver al menú
            </button>
            <h1 className="text-xl font-bold text-gray-900">
              Programación — Cuatrimestre {cuatrimestre}: {cuatrimestreInfo!.label}
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
                  onClick={() => seleccionarRenglon(s.renglon, "programacion")}
                  className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                >
                  <span className="font-semibold text-gray-900">{s.renglon}</span>
                  <span className="text-gray-500"> — {s.descripcion}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {renglonSeleccionado !== null && grupoActivo && (
          <>
            {/* ── Panel del grupo ── */}
            <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Grupo (renglones)</div>
                <div className="font-bold text-gray-900">{grupoActivo.label}</div>
              </div>
              <div>
                <div className="text-gray-500">Total vigente del grupo</div>
                <div className="font-bold text-gray-900">{Q(grupoActivo.totalVigente)}</div>
              </div>
              <div>
                <div className="text-gray-500">Tope 33.33% (este cuatrimestre)</div>
                <div className="font-bold text-gray-900">{Q(tope)}</div>
              </div>
              <div>
                <div className="text-gray-500">Ya programado / Disponible</div>
                <div className="font-bold">
                  <span className="text-gray-900">{Q(yaProgramado)}</span>
                  {" / "}
                  <span className="text-green-700">{Q(disponible)}</span>
                </div>
              </div>
            </div>

            {/* ── Tabla de sub-productos del renglón ── */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Sub-Producto</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Vigente</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Tipo</th>
                      {cuatrimestreInfo!.meses.map(m => (
                        <th key={m} className="px-3 py-2 text-right font-semibold text-gray-700 w-32">{m}</th>
                      ))}
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, idx) => {
                      const total = (Number(f.mes1) || 0) + (Number(f.mes2) || 0) + (Number(f.mes3) || 0) + (Number(f.mes4) || 0);
                      return (
                        <tr key={f.subProducto} className="border-b border-gray-100">
                          <td className="px-3 py-2">
                            <div className="font-mono text-xs text-gray-700">{f.subProducto}</div>
                            <div className="text-xs text-gray-400 truncate max-w-[220px]">{f.descripcion}</div>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">{Q(f.vigente)}</td>
                          <td className="px-3 py-2">
                            <select
                              value={f.tipo}
                              onChange={e => actualizarFila(idx, { tipo: e.target.value as "normal" | "regularizado", ok: false, error: null })}
                              className="input py-1 text-xs rounded-lg"
                            >
                              <option value="normal">Normal</option>
                              <option value="regularizado">Regularizado</option>
                            </select>
                          </td>
                          {(["mes1", "mes2", "mes3", "mes4"] as const).map(campo => (
                            <td key={campo} className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={f[campo]}
                                onChange={e => actualizarFila(idx, { [campo]: e.target.value, ok: false, error: null } as Partial<FilaEdicion>)}
                                className="input py-1 text-xs rounded-lg w-full text-right"
                                placeholder="0.00"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">{Q(total)}</td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => guardarFila(idx)}
                              disabled={f.guardando || total <= 0}
                              className="btn-primary py-1 px-3 text-xs rounded-lg disabled:opacity-50"
                            >
                              {f.guardando ? "Guardando…" : "Guardar"}
                            </button>
                            {f.ok && (
                              <div className="flex items-center gap-1 text-green-600 text-xs mt-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Guardado
                              </div>
                            )}
                            {f.error && <p className="text-red-600 text-xs mt-1 max-w-[180px]">{f.error}</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── Tabla de lo ya programado en este cuatrimestre ── */}
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900">Programado en este cuatrimestre</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Renglón</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Descripción</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Sub-Producto</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Tipo</th>
                    {cuatrimestreInfo!.meses.map(m => (
                      <th key={m} className="px-3 py-2 text-right font-semibold text-gray-700">{m}</th>
                    ))}
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {entradas.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                        Aún no hay nada programado en este cuatrimestre.
                      </td>
                    </tr>
                  ) : (
                    entradas.map(e => (
                      <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-semibold text-gray-900">{e.renglon}</td>
                        <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate">{e.descripcion}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{e.subProducto}</td>
                        <td className="px-3 py-2 text-gray-600 capitalize">{e.tipo}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{Q(e.mes1)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{Q(e.mes2)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{Q(e.mes3)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{Q(e.mes4)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">{Q(e.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Paso final · Reprogramación: buscar renglón, ver sub-productos y fijar el valor de la modificación ──
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
                onClick={() => seleccionarRenglon(s.renglon, "reprogramacion")}
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

      {/* ── Tabla de renglones ya modificados ── */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-gray-900">Modificaciones registradas</h2>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Renglón</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Descripción</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Sub-Producto</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Ingru</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Entre Renglones</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Ampliación</th>
                </tr>
              </thead>
              <tbody>
                {modificaciones.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                      Aún no hay modificaciones registradas.
                    </td>
                  </tr>
                ) : (
                  modificaciones.map(m => (
                    <tr key={`${m.renglon}-${m.subProducto}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold text-gray-900">{m.renglon}</td>
                      <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate">{m.descripcion}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{m.subProducto}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{Q(m.ingru)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{Q(m.entreRenglones)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{Q(m.ampliacion)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
