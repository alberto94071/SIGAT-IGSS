"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CheckCircle, ClipboardList, RefreshCw, XCircle, Trash2, Printer, Send, Loader2, ClipboardCheck } from "lucide-react";
import { CUATRIMESTRES } from "@/lib/programacion-constants";
import { fechaGuatemala } from "@/lib/date-utils";
import { mesDelCuatrimestreYaPaso } from "@/lib/programacion-fechas";
import {
  buscarRenglones, getSubproductosDeRenglon, getGrupos, getProgramadoDelGrupo,
  getEntradas, guardarEntrada, aprobarEntrada, rechazarEntrada, eliminarEntrada,
  getLoteBorrador, solicitarLote, getLotesPendientes, aprobarLote, rechazarLote,
  type SubproductoDisponible, type GrupoConTotales,
  type ProgramacionEntrada, type LoteReprogramacion,
} from "@/lib/programacion-actions";

const Q = (n: number) =>
  `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Modo = "programacion" | "reprogramacion" | "aprobaciones";

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

export default function ProgramacionClient() {
  const [modo, setModo] = useState<Modo | null>(null);
  const [cuatrimestre, setCuatrimestre] = useState<number | null>(null);

  const [grupos, setGrupos] = useState<GrupoConTotales[]>([]);
  const [entradas, setEntradas] = useState<ProgramacionEntrada[]>([]);
  const [loteBorrador, setLoteBorrador] = useState<LoteReprogramacion | null>(null);
  const [programadoPorGrupo, setProgramadoPorGrupo] = useState<Record<number, number>>({});

  const [renglonQuery, setRenglonQuery] = useState("");
  const [sugerencias, setSugerencias] = useState<SubproductoDisponible[]>([]);
  const [renglonSeleccionado, setRenglonSeleccionado] = useState<number | null>(null);
  const [filas, setFilas] = useState<FilaEdicion[]>([]);

  useEffect(() => { getGrupos().then(setGrupos); }, []);

  const recargarCuatrimestre = useCallback((c: number, gruposActuales: GrupoConTotales[]) => {
    getEntradas(c).then(setEntradas);
    getLoteBorrador(c).then(setLoteBorrador);
    Promise.all(gruposActuales.map(g => getProgramadoDelGrupo(c, g.id))).then(vals => {
      const mapa: Record<number, number> = {};
      gruposActuales.forEach((g, i) => { mapa[g.id] = vals[i]; });
      setProgramadoPorGrupo(mapa);
    });
  }, []);

  useEffect(() => {
    if (modo !== null && cuatrimestre !== null && grupos.length > 0) {
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

  const seleccionarRenglon = useCallback((renglon: number) => {
    setRenglonSeleccionado(renglon);
    setRenglonQuery("");
    setSugerencias([]);
    getSubproductosDeRenglon(renglon).then(subs => {
      setFilas(subs.map(s => ({
        subProducto: s.subProducto,
        descripcion: s.descripcion,
        vigente: s.vigente,
        tipo: "normal",
        mes1: "", mes2: "", mes3: "", mes4: "",
        guardando: false, error: null, ok: false,
      })));
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

  const [accionesEntrada, setAccionesEntrada] = useState<Record<number, { cargando: boolean; error: string | null }>>({});

  const ejecutarAccionEntrada = async (id: number, accion: (id: number) => Promise<{ ok: true } | { error: string }>) => {
    setAccionesEntrada(prev => ({ ...prev, [id]: { cargando: true, error: null } }));
    const res = await accion(id);
    if ("error" in res) {
      setAccionesEntrada(prev => ({ ...prev, [id]: { cargando: false, error: res.error } }));
    } else {
      setAccionesEntrada(prev => ({ ...prev, [id]: { cargando: false, error: null } }));
      if (cuatrimestre !== null) recargarCuatrimestre(cuatrimestre, grupos);
    }
  };

  const cuatrimestreInfo = cuatrimestre !== null ? CUATRIMESTRES.find(c => c.id === cuatrimestre)! : null;

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
            <p className="text-sm text-gray-500 mt-1">Asignar o cambiar el monto de un renglón dentro de un cuatrimestre ya en curso — se puede solicitar cualquier día, aunque el renglón no tuviera nada programado todavía.</p>
          </button>
          <button
            onClick={() => setModo("aprobaciones")}
            className="flex-1 sm:max-w-xs bg-white border-2 border-teal-200 hover:border-teal-500 rounded-2xl p-8 shadow-sm transition-colors text-left"
          >
            <ClipboardCheck className="w-8 h-8 text-teal-600 mb-3" />
            <h2 className="text-lg font-bold text-gray-900">Reprogramaciones pendientes</h2>
            <p className="text-sm text-gray-500 mt-1">Aprobar o rechazar, lote por lote, las Reprogramaciones ya solicitadas — solo del 1er al 5to día hábil de cada mes.</p>
          </button>
        </div>
      </div>
    );
  }

  // ── Paso · Reprogramaciones pendientes: aprobar/rechazar lotes, sin pasar por elegir cuatrimestre ──
  if (modo === "aprobaciones") {
    return <LotesPendientesView onVolverMenu={() => setModo(null)} />;
  }

  // ── Paso: elegir cuatrimestre (ambos modos) ──
  if (cuatrimestre === null) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => setModo(null)}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {modo === "programacion" ? "Programación" : "Reprogramación"} — Elige el cuatrimestre
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
    setCuatrimestre(null);
    setRenglonSeleccionado(null);
    setFilas([]);
  };

  // ── Paso final · Reprogramación: agregar/editar renglones en un lote y solicitarlo todo junto ──
  if (modo === "reprogramacion") {
    return (
      <ReprogramacionView
        cuatrimestre={cuatrimestre}
        cuatrimestreLabel={cuatrimestreInfo!.label}
        entradas={entradas}
        loteBorrador={loteBorrador}
        onVolverMenu={volverAlMenu}
        onCambiarCuatrimestre={() => setCuatrimestre(null)}
        onRecargar={() => recargarCuatrimestre(cuatrimestre, grupos)}
      />
    );
  }

  // ── Paso final · Programación: buscar renglón, ver sub-productos y programar por mes ──
  const hoy = fechaGuatemala();
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
        <div className="flex items-center gap-3">
          <Link
            href={`/presupuesto/programacion/imprimir/${cuatrimestre}?modo=programacion`}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </Link>
          <button
            onClick={() => setCuatrimestre(null)}
            className="text-sm text-brand-600 hover:text-brand-700 underline"
          >
            Cambiar cuatrimestre
          </button>
        </div>
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
                        {(["mes1", "mes2", "mes3", "mes4"] as const).map((campo, i) => {
                          const bloqueado = mesDelCuatrimestreYaPaso(cuatrimestre, i + 1, hoy);
                          return (
                            <td key={campo} className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={f[campo]}
                                disabled={bloqueado}
                                title={bloqueado ? "Este mes ya pasó" : undefined}
                                onChange={e => actualizarFila(idx, { [campo]: e.target.value, ok: false, error: null } as Partial<FilaEdicion>)}
                                className="input py-1 text-xs rounded-lg w-full text-right disabled:bg-gray-100 disabled:text-gray-400"
                                placeholder="0.00"
                              />
                            </td>
                          );
                        })}
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
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Estado</th>
                  {cuatrimestreInfo!.meses.map(m => (
                    <th key={m} className="px-3 py-2 text-right font-semibold text-gray-700">{m}</th>
                  ))}
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {entradas.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-gray-400">
                      Aún no hay nada programado en este cuatrimestre.
                    </td>
                  </tr>
                ) : (
                  entradas.map(e => {
                    const a = accionesEntrada[e.id];
                    const esSolicitado = e.estado === "Solicitado";
                    return (
                      <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-semibold text-gray-900">{e.renglon}</td>
                        <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate">{e.descripcion}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{e.subProducto}</td>
                        <td className="px-3 py-2 text-gray-600 capitalize">{e.tipo}</td>
                        <td className="px-3 py-2">{badgeEstado(e.estado)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{Q(e.mes1)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{Q(e.mes2)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{Q(e.mes3)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{Q(e.mes4)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">{Q(e.total)}</td>
                        <td className="px-3 py-2">
                          {esSolicitado && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => ejecutarAccionEntrada(e.id, aprobarEntrada)}
                                disabled={a?.cargando}
                                title="Aprobar"
                                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-50"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => ejecutarAccionEntrada(e.id, rechazarEntrada)}
                                disabled={a?.cargando}
                                title="Rechazar"
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => ejecutarAccionEntrada(e.id, eliminarEntrada)}
                                disabled={a?.cargando}
                                title="Eliminar"
                                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
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

function badgeEstado(estado: string) {
  const clases: Record<string, string> = {
    Borrador: "bg-gray-100 text-gray-600",
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

type BorradorLoteFila = {
  mes1: string; mes2: string; mes3: string; mes4: string;
  guardando: boolean; eliminando: boolean;
  error: string | null; ok: boolean;
};

// Reprogramación: puede tanto asignarle presupuesto por primera vez a un
// renglón dentro de un cuatrimestre en curso (buscador de arriba, igual que
// Programación pero sin restricción de fecha) como editar lo que ya existe.
// Cada guardado NO se solicita individualmente — se va acumulando renglón
// por renglón como "Borrador" dentro de un lote (loteBorrador); recién con
// el botón "Solicitar Reprogramación" se manda TODO el lote junto a
// aprobación. Si Presupuesto rechaza el lote, regresa completo a Borrador
// (no se pierde nada) para corregir la fila mala y volver a solicitar.
function ReprogramacionView({ cuatrimestre, cuatrimestreLabel, entradas, loteBorrador, onVolverMenu, onCambiarCuatrimestre, onRecargar }: {
  cuatrimestre: number;
  cuatrimestreLabel: string;
  entradas: ProgramacionEntrada[];
  loteBorrador: LoteReprogramacion | null;
  onVolverMenu: () => void;
  onCambiarCuatrimestre: () => void;
  onRecargar: () => void;
}) {
  const hoy = fechaGuatemala();
  const mesBloqueado = useCallback((indice: number) => mesDelCuatrimestreYaPaso(cuatrimestre, indice, hoy), [cuatrimestre, hoy]);

  // ── Buscar/agregar cualquier renglón (aunque no tenga nada programado
  // todavía en este cuatrimestre) — mismo patrón que Programación, pero
  // precargando mes1-4 si ya existe una entrada Aprobada para ese renglón/
  // sub-producto/tipo, en vez de dejarlo en blanco.
  const [busquedaQuery, setBusquedaQuery] = useState("");
  const [sugerencias, setSugerencias] = useState<SubproductoDisponible[]>([]);
  const [renglonSeleccionado, setRenglonSeleccionado] = useState<number | null>(null);
  const [filas, setFilas] = useState<FilaEdicion[]>([]);

  useEffect(() => {
    if (busquedaQuery.trim() === "") { setSugerencias([]); return; }
    const t = setTimeout(() => {
      buscarRenglones(busquedaQuery).then(rows => {
        const unicos = Array.from(new Map(rows.map(r => [r.renglon, r])).values());
        setSugerencias(unicos);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [busquedaQuery]);

  const valoresExistentes = useCallback((renglon: number, subProducto: string, tipo: "normal" | "regularizado") =>
    entradas.find(e => e.renglon === renglon && e.subProducto === subProducto && e.tipo === tipo && e.estado === "Aprobado"),
  [entradas]);

  const seleccionarRenglon = useCallback((renglon: number) => {
    setRenglonSeleccionado(renglon);
    setBusquedaQuery("");
    setSugerencias([]);
    getSubproductosDeRenglon(renglon).then(subs => {
      setFilas(subs.map(s => {
        const existente = valoresExistentes(renglon, s.subProducto, "normal");
        return {
          subProducto: s.subProducto,
          descripcion: s.descripcion,
          vigente: s.vigente,
          tipo: "normal" as const,
          mes1: existente ? String(existente.mes1 || "") : "",
          mes2: existente ? String(existente.mes2 || "") : "",
          mes3: existente ? String(existente.mes3 || "") : "",
          mes4: existente ? String(existente.mes4 || "") : "",
          guardando: false, error: null, ok: false,
        };
      }));
    });
  }, [valoresExistentes]);

  const actualizarFila = (idx: number, patch: Partial<FilaEdicion>) => {
    setFilas(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };

  const cambiarTipoFila = (idx: number, nuevoTipo: "normal" | "regularizado") => {
    if (renglonSeleccionado === null) return;
    const fila = filas[idx];
    const existente = valoresExistentes(renglonSeleccionado, fila.subProducto, nuevoTipo);
    actualizarFila(idx, {
      tipo: nuevoTipo,
      mes1: existente ? String(existente.mes1 || "") : "",
      mes2: existente ? String(existente.mes2 || "") : "",
      mes3: existente ? String(existente.mes3 || "") : "",
      mes4: existente ? String(existente.mes4 || "") : "",
      ok: false, error: null,
    });
  };

  const guardarFilaNueva = async (idx: number) => {
    if (renglonSeleccionado === null) return;
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
      modo: "reprogramacion",
    });
    if ("error" in res) {
      actualizarFila(idx, { guardando: false, error: res.error });
    } else {
      actualizarFila(idx, { guardando: false, ok: true, error: null });
      onRecargar();
    }
  };

  // ── Lote en construcción: lo que ya se ha ido guardando renglón por renglón ──
  const [borradoresLote, setBorradoresLote] = useState<Record<number, BorradorLoteFila>>({});
  const [solicitando, setSolicitando] = useState(false);
  const [errorSolicitar, setErrorSolicitar] = useState<string | null>(null);

  useEffect(() => {
    setBorradoresLote(prev => {
      const siguiente: Record<number, BorradorLoteFila> = {};
      for (const f of loteBorrador?.filas ?? []) {
        siguiente[f.id] = prev[f.id] ?? {
          mes1: String(f.mes1 || ""), mes2: String(f.mes2 || ""),
          mes3: String(f.mes3 || ""), mes4: String(f.mes4 || ""),
          guardando: false, eliminando: false, error: null, ok: false,
        };
      }
      return siguiente;
    });
  }, [loteBorrador]);

  const actualizarBorradorLote = (id: number, patch: Partial<BorradorLoteFila>) => {
    setBorradoresLote(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const guardarFilaLote = async (f: ProgramacionEntrada) => {
    actualizarBorradorLote(f.id, { guardando: true, error: null, ok: false });
    const b = borradoresLote[f.id];
    const res = await guardarEntrada({
      cuatrimestre, renglon: f.renglon, subProducto: f.subProducto, tipo: f.tipo,
      mes1: Number(b.mes1) || 0, mes2: Number(b.mes2) || 0,
      mes3: Number(b.mes3) || 0, mes4: Number(b.mes4) || 0,
      modo: "reprogramacion",
    });
    if ("error" in res) actualizarBorradorLote(f.id, { guardando: false, error: res.error });
    else { actualizarBorradorLote(f.id, { guardando: false, ok: true, error: null }); onRecargar(); }
  };

  const eliminarFilaLote = async (f: ProgramacionEntrada) => {
    actualizarBorradorLote(f.id, { eliminando: true, error: null });
    const res = await eliminarEntrada(f.id);
    if ("error" in res) actualizarBorradorLote(f.id, { eliminando: false, error: res.error });
    else onRecargar();
  };

  const handleSolicitar = async () => {
    if (!loteBorrador) return;
    setSolicitando(true); setErrorSolicitar(null);
    const res = await solicitarLote(loteBorrador.id);
    setSolicitando(false);
    if ("error" in res) setErrorSolicitar(res.error);
    else onRecargar();
  };

  const [filtroRenglon, setFiltroRenglon] = useState<number | null>(null);
  const [renglonQuery, setRenglonQuery] = useState("");

  // entradas ya viene sin lo "Borrador" (ver getEntradas) — eso vive en la
  // sección del lote de arriba.
  const entradasVisibles = filtroRenglon === null ? entradas : entradas.filter(e => e.renglon === filtroRenglon);
  const meses = CUATRIMESTRES.find(c => c.id === cuatrimestre)?.meses ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={onVolverMenu} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-1">
            <ArrowLeft className="w-4 h-4" /> Volver al menú
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            Reprogramación — Cuatrimestre {cuatrimestre}: {cuatrimestreLabel}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/presupuesto/programacion/imprimir/${cuatrimestre}?modo=reprogramacion`}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </Link>
          <button onClick={onCambiarCuatrimestre} className="text-sm text-brand-600 hover:text-brand-700 underline">
            Cambiar cuatrimestre
          </button>
        </div>
      </div>

      {/* ── Buscar/agregar cualquier renglón, tenga o no algo programado ya en este cuatrimestre ── */}
      <div className="relative max-w-sm">
        <label className="text-sm text-gray-600 font-medium block mb-1">Buscar renglón para asignar o cambiar su monto:</label>
        <input
          type="text"
          inputMode="numeric"
          value={busquedaQuery}
          onChange={e => setBusquedaQuery(e.target.value.replace(/\D/g, ""))}
          placeholder="Ej. 182 — puede ser un renglón nuevo, sin nada programado todavía"
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
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Tipo</th>
                  {meses.map(m => (
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
                          onChange={e => cambiarTipoFila(idx, e.target.value as "normal" | "regularizado")}
                          className="input py-1 text-xs rounded-lg"
                        >
                          <option value="normal">Normal</option>
                          <option value="regularizado">Regularizado</option>
                        </select>
                      </td>
                      {(["mes1", "mes2", "mes3", "mes4"] as const).map((campo, i) => {
                        const bloqueado = mesBloqueado(i + 1);
                        return (
                          <td key={campo} className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={f[campo]}
                              disabled={bloqueado}
                              title={bloqueado ? "Este mes ya pasó" : undefined}
                              onChange={e => actualizarFila(idx, { [campo]: e.target.value, ok: false, error: null } as Partial<FilaEdicion>)}
                              className="input py-1 text-xs rounded-lg w-full text-right disabled:bg-gray-100 disabled:text-gray-400"
                              placeholder="0.00"
                            />
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-semibold text-gray-900">{Q(total)}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => guardarFilaNueva(idx)}
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
      )}

      {/* ── Lote en construcción: todo lo que se ha ido guardando, todavía sin solicitar ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-bold text-gray-900">Reprogramación en construcción</h2>
          {loteBorrador && loteBorrador.filas.length > 0 && (
            <div className="text-right">
              <button
                onClick={handleSolicitar}
                disabled={solicitando}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {solicitando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Solicitar Reprogramación ({loteBorrador.filas.length} renglón{loteBorrador.filas.length === 1 ? "" : "es"})
              </button>
              {errorSolicitar && <p className="text-red-600 text-xs mt-1 max-w-xs">{errorSolicitar}</p>}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Cada renglón que guardes aquí se va acumulando sin solicitarse todavía — cuando termines de hacer todos los cambios que necesites, usa "Solicitar Reprogramación" para mandarlos todos juntos a aprobación de una sola vez.
        </p>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Renglón</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Descripción</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Sub-Producto</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Tipo</th>
                  {meses.map(m => (
                    <th key={m} className="px-3 py-2 text-right font-semibold text-gray-700 w-28">{m}</th>
                  ))}
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {!loteBorrador || loteBorrador.filas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                      Todavía no has agregado nada — busca un renglón arriba para empezar.
                    </td>
                  </tr>
                ) : (
                  loteBorrador.filas.map(f => {
                    const b = borradoresLote[f.id];
                    if (!b) return null;
                    return (
                      <tr key={f.id} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-semibold text-gray-900">{f.renglon}</td>
                        <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate">{f.descripcion}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{f.subProducto}</td>
                        <td className="px-3 py-2 text-gray-600 capitalize">{f.tipo}</td>
                        {(["mes1", "mes2", "mes3", "mes4"] as const).map((campo, i) => {
                          const bloqueado = mesBloqueado(i + 1);
                          return (
                            <td key={campo} className="px-3 py-2">
                              <input
                                type="number" min={0} step="0.01"
                                value={b[campo]}
                                disabled={bloqueado}
                                title={bloqueado ? "Este mes ya pasó" : undefined}
                                onChange={ev => actualizarBorradorLote(f.id, { [campo]: ev.target.value, ok: false, error: null } as Partial<BorradorLoteFila>)}
                                className="input py-1 text-xs rounded-lg w-full text-right disabled:bg-gray-100 disabled:text-gray-400"
                                placeholder="0.00"
                              />
                            </td>
                          );
                        })}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => guardarFilaLote(f)}
                              disabled={b.guardando}
                              className="btn-primary py-1 px-3 text-xs rounded-lg disabled:opacity-50"
                            >
                              {b.guardando ? "Guardando…" : "Guardar"}
                            </button>
                            <button
                              onClick={() => eliminarFilaLote(f)}
                              disabled={b.eliminando}
                              title="Quitar del lote"
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {b.ok && (
                            <div className="flex items-center gap-1 text-green-600 text-xs mt-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Guardado
                            </div>
                          )}
                          {b.error && <p className="text-red-600 text-xs mt-1 max-w-[200px]">{b.error}</p>}
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

      {/* ── Referencia: lo ya Aprobado o en trámite en este cuatrimestre (solo lectura) ── */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-gray-900">Programado en este cuatrimestre</h2>
        <div className="max-w-sm">
          <label className="text-sm text-gray-600 font-medium block mb-1">Filtrar por renglón (opcional):</label>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={renglonQuery}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, "");
                setRenglonQuery(v);
                setFiltroRenglon(v === "" ? null : Number(v));
              }}
              placeholder="Ej. 182"
              className="input w-full rounded-lg"
            />
            {filtroRenglon !== null && (
              <button onClick={() => { setRenglonQuery(""); setFiltroRenglon(null); }} className="text-xs text-gray-500 hover:text-gray-700 underline whitespace-nowrap">
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Renglón</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Descripción</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Sub-Producto</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Tipo</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Estado</th>
                  {meses.map(m => (
                    <th key={m} className="px-3 py-2 text-right font-semibold text-gray-700">{m}</th>
                  ))}
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {entradasVisibles.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                      No hay nada Aprobado ni en trámite todavía en este cuatrimestre.
                    </td>
                  </tr>
                ) : (
                  entradasVisibles.map(e => (
                    <tr key={e.id} className="border-b border-gray-100">
                      <td className="px-3 py-2 font-semibold text-gray-900">{e.renglon}</td>
                      <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate">{e.descripcion}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{e.subProducto}</td>
                      <td className="px-3 py-2 text-gray-600 capitalize">{e.tipo}</td>
                      <td className="px-3 py-2">{badgeEstado(e.estado)}</td>
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

// Aprobar/rechazar Reprogramaciones lote por lote — solo quien tenga acceso
// a mod_presupuesto puede que el click tenga efecto (el servidor valida),
// y solo dentro de la ventana de aprobación (primeros 5 días hábiles de
// cada mes). Rechazar no elimina el lote: lo regresa completo a Borrador
// para que quien lo solicitó corrija la fila mala y lo vuelva a solicitar.
function LotesPendientesView({ onVolverMenu }: { onVolverMenu: () => void }) {
  const [lotes, setLotes] = useState<LoteReprogramacion[] | null>(null);
  const [acciones, setAcciones] = useState<Record<number, { cargando: "aprobar" | "rechazar" | null; error: string | null }>>({});

  const recargar = useCallback(() => { getLotesPendientes().then(setLotes); }, []);
  useEffect(() => { recargar(); }, [recargar]);

  const ejecutar = async (loteId: number, accion: "aprobar" | "rechazar") => {
    setAcciones(prev => ({ ...prev, [loteId]: { cargando: accion, error: null } }));
    const res = await (accion === "aprobar" ? aprobarLote(loteId) : rechazarLote(loteId));
    if ("error" in res) {
      setAcciones(prev => ({ ...prev, [loteId]: { cargando: null, error: res.error } }));
    } else {
      setAcciones(prev => ({ ...prev, [loteId]: { cargando: null, error: null } }));
      recargar();
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={onVolverMenu} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Volver al menú
      </button>
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reprogramaciones pendientes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cada tarjeta es una Reprogramación completa, con todos los renglones que se solicitaron juntos. Se aprueba o se rechaza de una sola vez, no fila por fila.
        </p>
      </div>

      {lotes === null ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : lotes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay Reprogramaciones pendientes de aprobación.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {lotes.map(lote => {
            const a = acciones[lote.id];
            const meses = CUATRIMESTRES.find(c => c.id === lote.cuatrimestre)?.meses ?? [];
            const totalLote = lote.filas.reduce((s, f) => s + f.total, 0);
            return (
              <div key={lote.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-3 bg-amber-50 border-b border-amber-100">
                  <div>
                    <p className="font-semibold text-gray-900">
                      Cuatrimestre {lote.cuatrimestre} — {lote.filas.length} renglón{lote.filas.length === 1 ? "" : "es"}
                    </p>
                    <p className="text-xs text-gray-500">Total: {Q(totalLote)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => ejecutar(lote.id, "aprobar")}
                      disabled={a?.cargando !== null && a?.cargando !== undefined}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {a?.cargando === "aprobar" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Aprobar todo el lote
                    </button>
                    <button
                      onClick={() => ejecutar(lote.id, "rechazar")}
                      disabled={a?.cargando !== null && a?.cargando !== undefined}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {a?.cargando === "rechazar" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Rechazar todo el lote
                    </button>
                  </div>
                </div>
                {a?.error && <p className="text-red-600 text-xs px-4 py-2">{a.error}</p>}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Renglón</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Descripción</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Sub-Producto</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Tipo</th>
                        {meses.map(m => (
                          <th key={m} className="px-3 py-2 text-right font-semibold text-gray-700">{m}</th>
                        ))}
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lote.filas.map(f => (
                        <tr key={f.id} className="border-b border-gray-100">
                          <td className="px-3 py-2 font-semibold text-gray-900">{f.renglon}</td>
                          <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate">{f.descripcion}</td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-600">{f.subProducto}</td>
                          <td className="px-3 py-2 text-gray-600 capitalize">{f.tipo}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{Q(f.mes1)}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{Q(f.mes2)}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{Q(f.mes3)}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{Q(f.mes4)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">{Q(f.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
