"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Trash2, Send, X, Loader2, AlertTriangle, Clock } from "lucide-react";
import { agregarComision, eliminarComision, enviarViatico, type DatosComision } from "../actions";

type Firmante = { id: number; nombre: string; puesto_nominal: string | null };
type Precios = { desayuno: number; almuerzo: number; cena: number; hospedaje: number };
type Comision = {
  id: number; orden: number; lugar: string | null; departamento: string | null;
  tipo_comision: string | null; descripcion_comision: string | null;
  fecha_salida_unidad: string | null; hora_salida_unidad: string | null;
  fecha_llegada_lugar: string | null; hora_llegada_lugar: string | null;
  fecha_salida_lugar: string | null; hora_salida_lugar: string | null;
  fecha_entrada_unidad: string | null; hora_entrada_unidad: string | null;
  dias_calculados: number | null;
  nombramiento_numero: string | null; fecha_nombramiento: string | null;
  firmante_usuario_id: number | null; firmante_cargo_manual: string | null;
  cantidad_desayuno: number; cantidad_almuerzo: number; cantidad_cena: number; cantidad_hospedaje: number;
};
type Solicitud = {
  id: number; estado: string; numero_formulario: string | null;
  nombramiento_numero: string | null; fecha_nombramiento: string | null; fecha_limite: string | null;
  comisiones: Comision[];
};

const MAX_COMISIONES = 5;

function costoComision(c: Comision, p: Precios): number {
  return c.cantidad_desayuno * p.desayuno + c.cantidad_almuerzo * p.almuerzo
    + c.cantidad_cena * p.cena + c.cantidad_hospedaje * p.hospedaje;
}

export default function DetalleViaticoClient({ solicitud: init, firmantes, precios }: {
  solicitud: Solicitud; firmantes: Firmante[]; precios: Precios;
}) {
  const router = useRouter();
  const [solicitud, setSolicitud] = useState(init);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const puedeEditar = solicitud.estado === "Habilitado";
  const totalGeneral = solicitud.comisiones.reduce((s, c) => s + costoComision(c, precios), 0);
  const diasTotal = solicitud.comisiones.reduce((s, c) => s + (c.dias_calculados ?? 0), 0);

  function onAgregada(c: Comision) {
    setSolicitud(prev => ({ ...prev, comisiones: [...prev.comisiones, c] }));
    setMostrarForm(false);
    router.refresh();
  }

  async function handleEliminar(id: number) {
    await eliminarComision(id);
    setSolicitud(prev => ({ ...prev, comisiones: prev.comisiones.filter(c => c.id !== id) }));
    router.refresh();
  }

  async function handleEnviar() {
    setEnviando(true); setError("");
    const res = await enviarViatico(solicitud.id);
    setEnviando(false);
    if ("error" in res) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin className="w-5 h-5" /> Viático — Formulario {solicitud.numero_formulario ?? "—"}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Nombramiento {solicitud.nombramiento_numero} ({solicitud.fecha_nombramiento}) — hasta {MAX_COMISIONES} comisiones dentro del plazo.
        </p>
      </div>

      {solicitud.fecha_limite && puedeEditar && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <Clock className="w-4 h-4 shrink-0 mt-0.5" />
          Tenés hasta el <strong>{solicitud.fecha_limite}</strong> (10 días hábiles) para registrar y enviar este viático.
        </div>
      )}

      {solicitud.estado === "Enviado" && (
        <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <Clock className="w-4 h-4 shrink-0 mt-0.5" />
          Ya enviaste este viático — está pendiente de revisión, ya no se puede editar.
        </div>
      )}

      <div className="space-y-3">
        {solicitud.comisiones.map(c => (
          <div key={c.id} className="card p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Comisión {c.orden}</p>
                <p className="font-medium text-gray-900">{c.descripcion_comision}</p>
                <p className="text-sm text-gray-500">{c.lugar}, {c.departamento} — {c.dias_calculados} día(s)</p>
                <p className="text-xs text-gray-400 mt-1">Nombramiento {c.nombramiento_numero} ({c.fecha_nombramiento})</p>
              </div>
              {puedeEditar && (
                <button onClick={() => handleEliminar(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 pt-1 border-t border-gray-100">
              {c.cantidad_desayuno > 0 && <span>{c.cantidad_desayuno} desayuno(s)</span>}
              {c.cantidad_almuerzo > 0 && <span>{c.cantidad_almuerzo} almuerzo(s)</span>}
              {c.cantidad_cena > 0 && <span>{c.cantidad_cena} cena(s)</span>}
              {c.cantidad_hospedaje > 0 && <span>{c.cantidad_hospedaje} hospedaje(s)</span>}
              <span className="font-semibold text-gray-900 ml-auto">Q{costoComision(c, precios).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        ))}

        {solicitud.comisiones.length === 0 && (
          <div className="card p-6 text-center text-gray-400">
            <p className="text-sm">Todavía no registrás ninguna comisión.</p>
          </div>
        )}
      </div>

      {solicitud.comisiones.length > 0 && (
        <div className="card p-4 flex items-center justify-between text-sm">
          <span className="text-gray-500">{diasTotal} día(s) en total</span>
          <span className="font-bold text-gray-900 text-base">Total: Q{totalGeneral.toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span>
        </div>
      )}

      {puedeEditar && (
        <div className="flex items-center gap-3 flex-wrap">
          {solicitud.comisiones.length < MAX_COMISIONES && (
            <button onClick={() => setMostrarForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
              <Plus className="w-4 h-4" /> Agregar nuevo registro
            </button>
          )}
          {solicitud.comisiones.length > 0 && (
            <button onClick={handleEnviar} disabled={enviando}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors ml-auto">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {mostrarForm && (
        <ComisionForm
          solicitudId={solicitud.id}
          esPrimera={solicitud.comisiones.length === 0}
          nombramientoSolicitud={{ numero: solicitud.nombramiento_numero, fecha: solicitud.fecha_nombramiento }}
          anterior={solicitud.comisiones[solicitud.comisiones.length - 1] ?? null}
          firmantes={firmantes}
          precios={precios}
          onClose={() => setMostrarForm(false)}
          onAgregada={onAgregada}
        />
      )}
    </div>
  );
}

function diasPreview(f1: string, f2: string): number | null {
  if (!f1 || !f2) return null;
  const d1 = new Date(`${f1}T00:00:00Z`).getTime();
  const d2 = new Date(`${f2}T00:00:00Z`).getTime();
  if (d2 < d1) return null;
  return Math.round((d2 - d1) / 86400000) + 1;
}

function ComisionForm({ solicitudId, esPrimera, nombramientoSolicitud, anterior, firmantes, precios, onClose, onAgregada }: {
  solicitudId: number; esPrimera: boolean;
  nombramientoSolicitud: { numero: string | null; fecha: string | null };
  anterior: Comision | null; firmantes: Firmante[]; precios: Precios;
  onClose: () => void; onAgregada: (c: Comision) => void;
}) {
  const [lugar, setLugar] = useState(anterior?.lugar ?? "");
  const [departamento, setDepartamento] = useState(anterior?.departamento ?? "");
  const [tipoComision, setTipoComision] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaSalidaUnidad, setFechaSalidaUnidad] = useState("");
  const [horaSalidaUnidad, setHoraSalidaUnidad] = useState("");
  const [fechaLlegadaLugar, setFechaLlegadaLugar] = useState("");
  const [horaLlegadaLugar, setHoraLlegadaLugar] = useState("");
  const [fechaSalidaLugar, setFechaSalidaLugar] = useState("");
  const [horaSalidaLugar, setHoraSalidaLugar] = useState("");
  const [fechaEntradaUnidad, setFechaEntradaUnidad] = useState("");
  const [horaEntradaUnidad, setHoraEntradaUnidad] = useState("");
  const [nombramientoNumero, setNombramientoNumero] = useState(esPrimera ? (nombramientoSolicitud.numero ?? "") : "");
  const [fechaNombramiento, setFechaNombramiento] = useState(esPrimera ? (nombramientoSolicitud.fecha ?? "") : "");
  const [firmanteId, setFirmanteId] = useState<number | null>(anterior?.firmante_usuario_id ?? null);
  const [cargoManual, setCargoManual] = useState("");
  const [cantDesayuno, setCantDesayuno] = useState(0);
  const [cantAlmuerzo, setCantAlmuerzo] = useState(0);
  const [cantCena, setCantCena] = useState(0);
  const [cantHospedaje, setCantHospedaje] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const firmanteElegido = firmantes.find(f => f.id === firmanteId) ?? null;
  const necesitaCargoManual = !!firmanteElegido && !firmanteElegido.puesto_nominal;
  const dias = diasPreview(fechaSalidaUnidad, fechaEntradaUnidad);
  const costo = cantDesayuno * precios.desayuno + cantAlmuerzo * precios.almuerzo + cantCena * precios.cena + cantHospedaje * precios.hospedaje;

  async function handleGuardar() {
    setSaving(true); setError("");
    const datos: DatosComision = {
      lugar, departamento, tipo_comision: tipoComision, descripcion_comision: descripcion,
      fecha_salida_unidad: fechaSalidaUnidad, hora_salida_unidad: horaSalidaUnidad,
      fecha_llegada_lugar: fechaLlegadaLugar, hora_llegada_lugar: horaLlegadaLugar,
      fecha_salida_lugar: fechaSalidaLugar, hora_salida_lugar: horaSalidaLugar,
      fecha_entrada_unidad: fechaEntradaUnidad, hora_entrada_unidad: horaEntradaUnidad,
      nombramiento_numero: nombramientoNumero, fecha_nombramiento: fechaNombramiento,
      firmante_usuario_id: firmanteId, firmante_cargo_manual: cargoManual,
      cantidad_desayuno: cantDesayuno, cantidad_almuerzo: cantAlmuerzo, cantidad_cena: cantCena, cantidad_hospedaje: cantHospedaje,
    };
    const res = await agregarComision(solicitudId, datos);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    // El id/orden/dias reales los recalcula el servidor — se refresca la
    // página completa (router.refresh en el padre) así que acá solo se
    // cierra el formulario con un objeto temporal para la vista optimista.
    onAgregada({
      id: -Date.now(), orden: 0, lugar, departamento, tipo_comision: tipoComision, descripcion_comision: descripcion,
      fecha_salida_unidad: fechaSalidaUnidad, hora_salida_unidad: horaSalidaUnidad,
      fecha_llegada_lugar: fechaLlegadaLugar, hora_llegada_lugar: horaLlegadaLugar,
      fecha_salida_lugar: fechaSalidaLugar, hora_salida_lugar: horaSalidaLugar,
      fecha_entrada_unidad: fechaEntradaUnidad, hora_entrada_unidad: horaEntradaUnidad,
      dias_calculados: dias, nombramiento_numero: nombramientoNumero, fecha_nombramiento: fechaNombramiento,
      firmante_usuario_id: firmanteId, firmante_cargo_manual: cargoManual,
      cantidad_desayuno: cantDesayuno, cantidad_almuerzo: cantAlmuerzo, cantidad_cena: cantCena, cantidad_hospedaje: cantHospedaje,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Nuevo registro de comisión</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Lugar</label><input className="input" value={lugar} onChange={e => setLugar(e.target.value)} /></div>
            <div><label className="label">Departamento</label><input className="input" value={departamento} onChange={e => setDepartamento(e.target.value)} /></div>
          </div>
          <div>
            <label className="label">Tipo de comisión (opcional)</label>
            <input className="input" value={tipoComision} onChange={e => setTipoComision(e.target.value)} />
          </div>
          <div>
            <label className="label">Descripción de la comisión</label>
            <textarea className="input" rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </div>

          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider pt-1">Fechas y horas</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Salida de la unidad — fecha</label><input type="date" className="input" value={fechaSalidaUnidad} onChange={e => setFechaSalidaUnidad(e.target.value)} /></div>
            <div><label className="label">Salida de la unidad — hora</label><input type="time" className="input" value={horaSalidaUnidad} onChange={e => setHoraSalidaUnidad(e.target.value)} /></div>
            <div><label className="label">Llegada al lugar — fecha</label><input type="date" className="input" value={fechaLlegadaLugar} onChange={e => setFechaLlegadaLugar(e.target.value)} /></div>
            <div><label className="label">Llegada al lugar — hora</label><input type="time" className="input" value={horaLlegadaLugar} onChange={e => setHoraLlegadaLugar(e.target.value)} /></div>
            <div><label className="label">Salida del lugar — fecha</label><input type="date" className="input" value={fechaSalidaLugar} onChange={e => setFechaSalidaLugar(e.target.value)} /></div>
            <div><label className="label">Salida del lugar — hora</label><input type="time" className="input" value={horaSalidaLugar} onChange={e => setHoraSalidaLugar(e.target.value)} /></div>
            <div><label className="label">Entrada a la unidad — fecha</label><input type="date" className="input" value={fechaEntradaUnidad} onChange={e => setFechaEntradaUnidad(e.target.value)} /></div>
            <div><label className="label">Entrada a la unidad — hora</label><input type="time" className="input" value={horaEntradaUnidad} onChange={e => setHoraEntradaUnidad(e.target.value)} /></div>
          </div>
          {dias != null && <p className="text-xs text-gray-500">Días de comisión calculados: <strong>{dias}</strong></p>}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div><label className="label">No. de Nombramiento</label><input className="input font-mono" value={nombramientoNumero} onChange={e => setNombramientoNumero(e.target.value)} /></div>
            <div><label className="label">Fecha de Nombramiento</label><input type="date" className="input" value={fechaNombramiento} onChange={e => setFechaNombramiento(e.target.value)} /></div>
          </div>

          <div>
            <label className="label">Quién firmó el nombramiento</label>
            <select className="input" value={firmanteId ?? ""} onChange={e => setFirmanteId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Elegí —</option>
              {firmantes.map(f => <option key={f.id} value={f.id}>{f.nombre}{f.puesto_nominal ? ` — ${f.puesto_nominal}` : ""}</option>)}
            </select>
          </div>
          {necesitaCargoManual && (
            <div>
              <label className="label">Cargo de {firmanteElegido?.nombre} (no está cargado en el sistema)</label>
              <input className="input" value={cargoManual} onChange={e => setCargoManual(e.target.value)} />
            </div>
          )}

          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider pt-1">Servicios (precio fijo)</p>
          <div className="grid grid-cols-2 gap-3">
            <ServicioInput label={`Desayuno (Q${precios.desayuno})`} value={cantDesayuno} onChange={setCantDesayuno} />
            <ServicioInput label={`Almuerzo (Q${precios.almuerzo})`} value={cantAlmuerzo} onChange={setCantAlmuerzo} />
            <ServicioInput label={`Cena (Q${precios.cena})`} value={cantCena} onChange={setCantCena} />
            <ServicioInput label={`Hospedaje (Q${precios.hospedaje})`} value={cantHospedaje} onChange={setCantHospedaje} />
          </div>
          <p className="text-sm text-right text-gray-700">Subtotal servicios: <strong>Q{costo.toLocaleString("es-GT", { minimumFractionDigits: 2 })}</strong></p>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

function ServicioInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" min={0} step="1" className="input" value={value}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))} />
    </div>
  );
}
