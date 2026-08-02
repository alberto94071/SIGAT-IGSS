"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ClipboardList, RefreshCw, XCircle, Trash2, Printer } from "lucide-react";
import { CUATRIMESTRES } from "@/lib/programacion-constants";
import {
  buscarRenglones, getSubproductosDeRenglon, getGrupos, getProgramadoDelGrupo,
  getEntradas, guardarEntrada, rechazarEntrada, eliminarEntrada,
  type SubproductoDisponible, type GrupoConTotales,
  type ProgramacionEntrada,
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

export default function ProgramacionClient() {
  const [modo, setModo] = useState<Modo | null>(null);
  const [cuatrimestre, setCuatrimestre] = useState<number | null>(null);

  const [grupos, setGrupos] = useState<GrupoConTotales[]>([]);
  const [entradas, setEntradas] = useState<ProgramacionEntrada[]>([]);
  const [programadoPorGrupo, setProgramadoPorGrupo] = useState<Record<number, number>>({});

  const [renglonQuery, setRenglonQuery] = useState("");
  const [sugerencias, setSugerencias] = useState<SubproductoDisponible[]>([]);
  const [renglonSeleccionado, setRenglonSeleccionado] = useState<number | null>(null);
  const [filas, setFilas] = useState<FilaEdicion[]>([]);

  useEffect(() => { getGrupos().then(setGrupos); }, []);

  const recargarCuatrimestre = useCallback((c: number, gruposActuales: GrupoConTotales[]) => {
    getEntradas(c).then(setEntradas);
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
            <p className="text-sm text-gray-500 mt-1">Registrar una modificación presupuestaria (Ingru, entre renglones o ampliación).</p>
          </button>
        </div>
      </div>
    );
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

  // ── Paso final · Reprogramación: revisar/editar lo ya programado en el cuatrimestre ──
  if (modo === "reprogramacion") {
    return (
      <ReprogramacionView
        cuatrimestre={cuatrimestre}
        cuatrimestreLabel={cuatrimestreInfo!.label}
        entradas={entradas}
        onVolverMenu={volverAlMenu}
        onCambiarCuatrimestre={() => setCuatrimestre(null)}
        onRecargar={() => recargarCuatrimestre(cuatrimestre, grupos)}
      />
    );
  }

  // ── Paso final · Programación: buscar renglón, ver sub-productos y programar por mes ──
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
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Estado</th>
                  {cuatrimestreInfo!.meses.map(m => (
                    <th key={m} className="px-3 py-2 text-right font-semibold text-gray-700">{m}</th>
                  ))}
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {entradas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
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

type BorradorReprogramacion = {
  mes1: string; mes2: string; mes3: string; mes4: string;
  guardando: boolean; accion: "rechazar" | "eliminar" | null;
  error: string | null; ok: boolean;
};

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

// Reprogramación: a diferencia de Programación (que crea entradas nuevas),
// aquí se listan y editan las ya existentes del cuatrimestre — reutiliza
// guardarEntrada(modo:"reprogramacion") por fila, que valida la ventana de
// fecha y regresa la fila a "Solicitado" para que pase de nuevo por la
// aprobación automática. Rechazar/Eliminar solo aplican mientras siga
// "Solicitado" (para corregir un error antes de que se apruebe).
function ReprogramacionView({ cuatrimestre, cuatrimestreLabel, entradas, onVolverMenu, onCambiarCuatrimestre, onRecargar }: {
  cuatrimestre: number;
  cuatrimestreLabel: string;
  entradas: ProgramacionEntrada[];
  onVolverMenu: () => void;
  onCambiarCuatrimestre: () => void;
  onRecargar: () => void;
}) {
  const [renglonQuery, setRenglonQuery] = useState("");
  const [filtroRenglon, setFiltroRenglon] = useState<number | null>(null);
  const [borradores, setBorradores] = useState<Record<number, BorradorReprogramacion>>({});

  useEffect(() => {
    setBorradores(prev => {
      const siguiente: Record<number, BorradorReprogramacion> = {};
      for (const e of entradas) {
        siguiente[e.id] = prev[e.id] ?? {
          mes1: String(e.mes1 || ""), mes2: String(e.mes2 || ""),
          mes3: String(e.mes3 || ""), mes4: String(e.mes4 || ""),
          guardando: false, accion: null, error: null, ok: false,
        };
      }
      return siguiente;
    });
  }, [entradas]);

  const actualizarBorrador = (id: number, patch: Partial<BorradorReprogramacion>) => {
    setBorradores(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const guardarFila = async (e: ProgramacionEntrada) => {
    actualizarBorrador(e.id, { guardando: true, error: null, ok: false });
    const b = borradores[e.id];
    const res = await guardarEntrada({
      cuatrimestre, renglon: e.renglon, subProducto: e.subProducto, tipo: e.tipo,
      mes1: Number(b.mes1) || 0, mes2: Number(b.mes2) || 0,
      mes3: Number(b.mes3) || 0, mes4: Number(b.mes4) || 0,
      modo: "reprogramacion",
    });
    if ("error" in res) {
      actualizarBorrador(e.id, { guardando: false, error: res.error });
    } else {
      actualizarBorrador(e.id, { guardando: false, ok: true, error: null });
      onRecargar();
    }
  };

  const rechazarFila = async (e: ProgramacionEntrada) => {
    actualizarBorrador(e.id, { accion: "rechazar", error: null, ok: false });
    const res = await rechazarEntrada(e.id);
    if ("error" in res) actualizarBorrador(e.id, { accion: null, error: res.error });
    else onRecargar();
  };

  const eliminarFila = async (e: ProgramacionEntrada) => {
    actualizarBorrador(e.id, { accion: "eliminar", error: null, ok: false });
    const res = await eliminarEntrada(e.id);
    if ("error" in res) actualizarBorrador(e.id, { accion: null, error: res.error });
    else onRecargar();
  };

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
                  <th key={m} className="px-3 py-2 text-right font-semibold text-gray-700 w-28">{m}</th>
                ))}
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {entradasVisibles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                    No hay nada programado todavía en este cuatrimestre para reprogramar.
                  </td>
                </tr>
              ) : (
                entradasVisibles.map(e => {
                  const b = borradores[e.id];
                  if (!b) return null;
                  const esSolicitado = e.estado === "Solicitado";
                  return (
                    <tr key={e.id} className="border-b border-gray-100">
                      <td className="px-3 py-2 font-semibold text-gray-900">{e.renglon}</td>
                      <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate">{e.descripcion}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{e.subProducto}</td>
                      <td className="px-3 py-2 text-gray-600 capitalize">{e.tipo}</td>
                      <td className="px-3 py-2">{badgeEstado(e.estado)}</td>
                      {(["mes1", "mes2", "mes3", "mes4"] as const).map(campo => (
                        <td key={campo} className="px-3 py-2">
                          <input
                            type="number" min={0} step="0.01"
                            value={b[campo]}
                            onChange={ev => actualizarBorrador(e.id, { [campo]: ev.target.value, ok: false, error: null } as Partial<BorradorReprogramacion>)}
                            className="input py-1 text-xs rounded-lg w-full text-right"
                            placeholder="0.00"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => guardarFila(e)}
                            disabled={b.guardando}
                            className="btn-primary py-1 px-3 text-xs rounded-lg disabled:opacity-50"
                          >
                            {b.guardando ? "Guardando…" : "Guardar"}
                          </button>
                          {esSolicitado && (
                            <>
                              <button
                                onClick={() => rechazarFila(e)}
                                disabled={b.accion !== null}
                                title="Rechazar"
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => eliminarFila(e)}
                                disabled={b.accion !== null}
                                title="Eliminar"
                                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
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
  );
}
