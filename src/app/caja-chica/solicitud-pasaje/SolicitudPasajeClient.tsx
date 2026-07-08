"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { Bus, Plus, X, Loader2, AlertTriangle, Printer, Search } from "lucide-react";
import { crearSolicitudPasaje, type NuevaSolicitudData } from "@/lib/pasajes-actions";
import { buscarAfiliados } from "@/lib/afiliados-actions";

type Tarifa = { id: number; punto_partida: string; destino: string; valor_ida: number };
type Afiliado = { id: number; afiliacion: string; nombre: string; calidad: string | null; direccion: string | null };
type Solicitud = {
  id: number; numero: number; fecha: string; afiliacion: string; nombre_afiliado: string;
  tramo: string; punto_partida: string; destino: string; estado: string;
};

export default function SolicitudPasajeClient({
  solicitudes: init, tarifario, canEdit,
}: { solicitudes: Solicitud[]; tarifario: Tarifa[]; canEdit: boolean }) {
  const [solicitudes, setSolicitudes] = useState(init);
  const [modal, setModal] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bus className="w-5 h-5" /> Solicitud Pasaje
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{solicitudes.length} solicitud(es) (SPS-75) registrada(s)</p>
        </div>
        {canEdit && (
          <button onClick={() => setModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Solicitar Pago de Pasaje
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">SPS-75</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Afiliación</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Ruta</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Tramo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {solicitudes.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{String(s.numero).padStart(4, "0")}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.fecha}</td>
                  <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{s.afiliacion}</td>
                  <td className="px-4 py-3 text-gray-700">{s.nombre_afiliado}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{s.punto_partida} → {s.destino}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.tramo}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.estado === "Generado" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {s.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/caja-chica/solicitud-pasaje/${s.numero}/imprimir`}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors ml-auto w-fit">
                      <Printer className="w-3 h-3" /> SPS-75
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {solicitudes.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Bus className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aún no se ha registrado ninguna solicitud de pasaje.</p>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <NuevaSolicitudModal
          tarifario={tarifario}
          onClose={() => setModal(false)}
          onCreado={s => { setSolicitudes(prev => [s, ...prev]); setModal(false); }}
        />
      )}
    </div>
  );
}

function AfiliadoPicker({ onSeleccionar }: { onSeleccionar: (a: Afiliado) => void }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Afiliado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) { setResultados([]); return; }
    timer.current = setTimeout(async () => {
      setBuscando(true);
      const r = await buscarAfiliados(query.trim());
      setBuscando(false);
      setResultados(r as unknown as Afiliado[]);
      setAbierto(true);
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input className="flex-1 outline-none text-sm" placeholder="Buscar por número de afiliación o nombre…"
          value={query} onChange={e => setQuery(e.target.value)} onFocus={() => setAbierto(true)} />
        {buscando && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
      </div>
      {abierto && resultados.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {resultados.map(a => (
            <button key={a.id} type="button"
              onClick={() => { onSeleccionar(a); setQuery(""); setResultados([]); setAbierto(false); }}
              className="flex flex-col w-full text-left px-3 py-2 hover:bg-brand-50 border-b border-gray-100 last:border-0">
              <span className="text-sm font-medium text-gray-900">{a.nombre}</span>
              <span className="text-xs text-gray-500 font-mono">{a.afiliacion} {a.calidad ? `— ${a.calidad}` : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NuevaSolicitudModal({
  tarifario, onClose, onCreado,
}: { tarifario: Tarifa[]; onClose: () => void; onCreado: (s: Solicitud) => void }) {
  const [afiliado, setAfiliado] = useState<Afiliado | null>(null);

  const puntos = useMemo(() => Array.from(new Set(tarifario.map(t => t.punto_partida))).sort(), [tarifario]);
  const [puntoPartida, setPuntoPartida] = useState("");
  const destinos = useMemo(
    () => Array.from(new Set(tarifario.filter(t => t.punto_partida === puntoPartida).map(t => t.destino))).sort(),
    [tarifario, puntoPartida]
  );
  const [destino, setDestino] = useState("");
  const [lugarEspecifico, setLugarEspecifico] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const [tramo, setTramo] = useState<"Ida" | "Vuelta">("Ida");
  const [casoConcluido, setCasoConcluido] = useState(false);
  const [fechaCita, setFechaCita] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const tarifa = tarifario.find(t => t.punto_partida === puntoPartida && t.destino === destino) ?? null;

  async function handleGuardar() {
    if (!afiliado) return setError("Busca y selecciona al afiliado");
    if (!puntoPartida || !destino) return setError("Selecciona el punto de partida y el destino");
    if (!casoConcluido && !fechaCita) return setError("Indica la fecha de la cita, o marca que el caso fue concluido");

    const data: NuevaSolicitudData = {
      afiliacion: afiliado.afiliacion, tramo, punto_partida: puntoPartida, destino,
      lugar_especifico: lugarEspecifico, especialidad, caso_concluido: casoConcluido, fecha_cita: fechaCita, observaciones,
    };
    setSaving(true); setError("");
    const res = await crearSolicitudPasaje(data);
    setSaving(false);
    if ("error" in res) return setError(res.error);

    onCreado({
      id: res.numero, numero: res.numero, fecha: new Date().toISOString().slice(0, 10),
      afiliacion: afiliado.afiliacion, nombre_afiliado: afiliado.nombre, tramo,
      punto_partida: puntoPartida, destino, estado: "Pendiente DPD-23",
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Solicitar Pago de Pasaje (SPS-75)</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="label">Afiliado</label>
            {afiliado ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{afiliado.nombre}</p>
                  <p className="text-xs text-gray-500 font-mono">{afiliado.afiliacion} {afiliado.calidad ? `— ${afiliado.calidad}` : ""}</p>
                </div>
                <button onClick={() => setAfiliado(null)} className="text-xs text-gray-500 hover:text-red-600">Cambiar</button>
              </div>
            ) : (
              <AfiliadoPicker onSeleccionar={setAfiliado} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Punto de partida</label>
              <select className="input" value={puntoPartida} onChange={e => { setPuntoPartida(e.target.value); setDestino(""); }}>
                <option value="">Selecciona…</option>
                {puntos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Destino</label>
              <select className="input" value={destino} onChange={e => setDestino(e.target.value)} disabled={!puntoPartida}>
                <option value="">Selecciona…</option>
                {destinos.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Lugar específico (opcional)</label>
            <input className="input" value={lugarEspecifico} onChange={e => setLugarEspecifico(e.target.value)}
              placeholder="Ej. Consultorio San Marcos" />
          </div>

          <div>
            <label className="label">Tramo a pagar</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                <input type="radio" name="tramo" checked={tramo === "Ida"} onChange={() => setTramo("Ida")} className="w-4 h-4 accent-brand-600" /> Solo ida
              </label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                <input type="radio" name="tramo" checked={tramo === "Vuelta"} onChange={() => setTramo("Vuelta")} className="w-4 h-4 accent-brand-600" /> Solo regreso
              </label>
              {tarifa && <span className="ml-auto text-sm font-mono font-bold text-green-700">Q{tarifa.valor_ida.toFixed(2)}</span>}
            </div>
            {puntoPartida && destino && !tarifa && (
              <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                No existe tarifa para esta ruta. Regístrala primero en Caja Chica/Tarifario.
              </p>
            )}
          </div>

          <div>
            <label className="label">Transporte ordenado por (servicio / especialidad)</label>
            <input className="input" value={especialidad} onChange={e => setEspecialidad(e.target.value)}
              placeholder="Ej. MEDICINA GENERAL" />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm text-gray-700 mb-1.5">
              <input type="checkbox" checked={casoConcluido} onChange={e => setCasoConcluido(e.target.checked)} className="w-4 h-4 accent-brand-600" />
              Su caso fue concluido
            </label>
            {!casoConcluido && (
              <div>
                <label className="label">Se le citó para el día</label>
                <input type="date" className="input" value={fechaCita} onChange={e => setFechaCita(e.target.value)} />
              </div>
            )}
          </div>

          <div>
            <label className="label">Observaciones (hacia dónde fue / motivo del viaje)</label>
            <textarea className="input" rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)}
              placeholder="Ej. Consulta con especialidad de Medicina Interna en IGSS San Marcos" />
            {afiliado?.direccion && (
              <p className="mt-1 text-xs text-gray-400">
                En el SPS-75 se imprimirá antes: &quot;PACIENTE CON RESIDENCIA EN: {afiliado.direccion}&quot;
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Generar SPS-75
          </button>
        </div>
      </div>
    </div>
  );
}
