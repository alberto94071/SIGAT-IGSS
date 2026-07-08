"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Bus, Plus, X, Loader2, AlertTriangle, Printer, Search } from "lucide-react";
import { registrarPagoPasaje, buscarAfiliado, type NuevoPagoPasajeData } from "@/lib/pasajes-actions";

type Tarifa = { id: number; punto_partida: string; destino: string; valor_ida: number };
type Vale = { id: number; numero: number; monto: number; solicitante_nombre: string; numero_cheque: string };
type Pago = {
  id: number; formulario_no: number; fecha_pago: string; afiliacion: string; nombre_afiliado: string;
  punto_partida: string; destino: string; ida: boolean; vuelta: boolean; valor_pasaje: number;
  poliza_no: number | null; cheque_no: string | null; vale_numero: number | null;
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SolicitudPasajeClient({
  pagos: init, tarifario, vales: valesInit, canEdit,
}: { pagos: Pago[]; tarifario: Tarifa[]; vales: Vale[]; canEdit: boolean }) {
  const [pagos, setPagos] = useState(init);
  const [modal, setModal] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bus className="w-5 h-5" /> Solicitud Pasaje
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{pagos.length} pasaje(s) pagado(s)</p>
        </div>
        {canEdit && (
          <button onClick={() => setModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Registrar Pago
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Formulario</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Afiliación</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Ruta</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Póliza</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Cheque / Vale</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Valor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagos.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{String(p.formulario_no).padStart(4, "0")}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.fecha_pago}</td>
                  <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{p.afiliacion}</td>
                  <td className="px-4 py-3 text-gray-700">{p.nombre_afiliado}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {p.punto_partida} → {p.destino}
                    <span className="ml-1 text-gray-400">({[p.ida && "ida", p.vuelta && "vuelta"].filter(Boolean).join("/")})</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.poliza_no ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {p.cheque_no || "—"} {p.vale_numero != null && <span className="text-gray-400">/ vale {String(p.vale_numero).padStart(7, "0")}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">{Q(p.valor_pasaje)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/caja-chica/sps-23/${p.formulario_no}`}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors ml-auto w-fit">
                      <Printer className="w-3 h-3" /> DPD-23
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagos.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Bus className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aún no se ha registrado ningún pago de pasaje.</p>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <NuevoPagoModal
          tarifario={tarifario}
          vales={valesInit}
          onClose={() => setModal(false)}
          onCreado={p => { setPagos(prev => [p, ...prev]); setModal(false); }}
        />
      )}
    </div>
  );
}

function NuevoPagoModal({
  tarifario, vales, onClose, onCreado,
}: { tarifario: Tarifa[]; vales: Vale[]; onClose: () => void; onCreado: (p: Pago) => void }) {
  const [afiliacion, setAfiliacion] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [afiliado, setAfiliado] = useState<{ nombre: string; calidad: string | null } | null>(null);
  const [afiliadoError, setAfiliadoError] = useState("");

  const puntos = useMemo(() => Array.from(new Set(tarifario.map(t => t.punto_partida))).sort(), [tarifario]);
  const [puntoPartida, setPuntoPartida] = useState("");
  const destinos = useMemo(
    () => Array.from(new Set(tarifario.filter(t => t.punto_partida === puntoPartida).map(t => t.destino))).sort(),
    [tarifario, puntoPartida]
  );
  const [destino, setDestino] = useState("");
  const [ida, setIda] = useState(true);
  const [vuelta, setVuelta] = useState(true);

  const tarifa = useMemo(
    () => tarifario.find(t => t.punto_partida === puntoPartida && t.destino === destino) ?? null,
    [tarifario, puntoPartida, destino]
  );
  const valorPasaje = tarifa ? (ida ? tarifa.valor_ida : 0) + (vuelta ? tarifa.valor_ida : 0) : 0;

  const [observaciones, setObservaciones] = useState("");
  const [fechaCita, setFechaCita] = useState("");
  const [polizaNo, setPolizaNo] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [valeId, setValeId] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleBuscarAfiliado() {
    if (!afiliacion.trim()) return;
    setBuscando(true); setAfiliadoError(""); setAfiliado(null);
    const a = await buscarAfiliado(afiliacion.trim());
    setBuscando(false);
    if (!a) { setAfiliadoError("No se encontró un afiliado con ese número de afiliación"); return; }
    setAfiliado({ nombre: a.nombre, calidad: a.calidad });
  }

  async function handleGuardar() {
    if (!afiliado) return setError("Busca y confirma el afiliado antes de continuar");
    if (!puntoPartida || !destino) return setError("Selecciona el punto de partida y el destino");
    if (!ida && !vuelta) return setError("Selecciona al menos Ida o Vuelta");
    if (!chequeNo.trim()) return setError("El número de cheque es obligatorio");
    if (!valeId) return setError("Selecciona el número de vale");

    const data: NuevoPagoPasajeData = {
      afiliacion: afiliacion.trim(), punto_partida: puntoPartida, destino, ida, vuelta,
      observaciones, fecha_cita: fechaCita, poliza_no: polizaNo ? Number(polizaNo) : null,
      cheque_no: chequeNo, vale_id: valeId,
    };
    setSaving(true); setError("");
    const res = await registrarPagoPasaje(data);
    setSaving(false);
    if ("error" in res) return setError(res.error);

    const vale = vales.find(v => v.id === valeId);
    onCreado({
      id: res.formulario_no, formulario_no: res.formulario_no, fecha_pago: new Date().toISOString().slice(0, 10),
      afiliacion: afiliacion.trim(), nombre_afiliado: afiliado.nombre, punto_partida: puntoPartida, destino,
      ida, vuelta, valor_pasaje: valorPasaje, poliza_no: data.poliza_no, cheque_no: chequeNo,
      vale_numero: vale?.numero ?? null,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Registrar Pago de Pasaje</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="label">Número de Afiliación</label>
            <div className="flex gap-2">
              <input className="input font-mono flex-1" value={afiliacion}
                onChange={e => { setAfiliacion(e.target.value); setAfiliado(null); }}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleBuscarAfiliado())} />
              <button onClick={handleBuscarAfiliado} disabled={buscando}
                className="px-3 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">
                {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
            {afiliado && (
              <p className="mt-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                <strong>{afiliado.nombre}</strong>{afiliado.calidad ? ` — ${afiliado.calidad}` : ""}
              </p>
            )}
            {afiliadoError && <p className="mt-1.5 text-xs text-red-600">{afiliadoError}</p>}
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

          <div className="flex items-center gap-5">
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="checkbox" checked={ida} onChange={e => setIda(e.target.checked)} className="w-4 h-4 accent-brand-600" /> Ida
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="checkbox" checked={vuelta} onChange={e => setVuelta(e.target.checked)} className="w-4 h-4 accent-brand-600" /> Vuelta
            </label>
            {tarifa && (
              <span className="ml-auto text-sm font-mono font-bold text-green-700">{Q(valorPasaje)}</span>
            )}
          </div>
          {puntoPartida && destino && !tarifa && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              No existe tarifa para esta ruta. Regístrala primero en Caja Chica/Tarifario.
            </p>
          )}

          <div>
            <label className="label">Observaciones</label>
            <textarea className="input" rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha de Cita</label>
              <input type="date" className="input" value={fechaCita} onChange={e => setFechaCita(e.target.value)} />
            </div>
            <div>
              <label className="label">Póliza No.</label>
              <input type="number" className="input" value={polizaNo} onChange={e => setPolizaNo(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Cheque No.</label>
            <input className="input font-mono" value={chequeNo} onChange={e => setChequeNo(e.target.value)} />
          </div>

          <div>
            <label className="label">Vale de Caja Chica</label>
            {vales.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                No hay vales pendientes. Debes generarlo primero en Caja Chica/Vale.
              </p>
            ) : (
              <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                {vales.map(v => (
                  <label key={v.id}
                    className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer ${valeId === v.id ? "bg-brand-50" : "bg-white"}`}>
                    <input type="radio" name="vale" checked={valeId === v.id} onChange={() => setValeId(v.id)} className="w-4 h-4 accent-brand-600" />
                    <div className="flex-1 text-sm">
                      <p className="font-mono font-semibold text-gray-900">{String(v.numero).padStart(7, "0")}</p>
                      <p className="text-xs text-gray-500">{v.solicitante_nombre}</p>
                    </div>
                    <span className="font-mono text-sm font-bold text-green-700">{Q(v.monto)}</span>
                  </label>
                ))}
              </div>
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
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Registrar Pago
          </button>
        </div>
      </div>
    </div>
  );
}
