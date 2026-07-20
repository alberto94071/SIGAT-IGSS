"use client";
import { fechaGuatemala } from "@/lib/date-utils";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Plus, X, Loader2, AlertTriangle, Printer, Trash2 } from "lucide-react";
import { crearLiquidacion, type Comision } from "./actions";

type Liquidacion = {
  id: number; fecha_pago: string | null; persona_nombre: string; comisiones: Comision[];
  gasto_desayuno: number | null; gasto_almuerzo: number | null; gasto_cena: number | null; gasto_hospedaje: number | null;
  otros_gastos: number;
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function totalDe(l: Liquidacion): number {
  const suma = (l.gasto_desayuno ?? 0) + (l.gasto_almuerzo ?? 0) + (l.gasto_cena ?? 0) + (l.gasto_hospedaje ?? 0);
  return suma + l.otros_gastos;
}

export default function EntregaFormularioClient({ liquidaciones: init, canEdit }: { liquidaciones: Liquidacion[]; canEdit: boolean }) {
  const router = useRouter();
  const [liquidaciones, setLiquidaciones] = useState(init);
  const [modal, setModal] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5" /> Entrega de Formulario — Planilla de Viático (V-L)
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{liquidaciones.length} liquidación(es) registrada(s)</p>
        </div>
        {canEdit && (
          <button onClick={() => setModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nueva Liquidación
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha de Pago</th>
                <th className="px-4 py-3 text-left">Persona Nombrada</th>
                <th className="px-4 py-3 text-left">Comisión</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {liquidaciones.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{l.fecha_pago}</td>
                  <td className="px-4 py-3 text-gray-700">{l.persona_nombre}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{l.comisiones[0]?.tipo ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">{Q(totalDe(l))}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/viaticos/entrega-formulario/${l.id}/imprimir`}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors ml-auto w-fit">
                      <Printer className="w-3 h-3" /> Imprimir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {liquidaciones.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aún no se ha registrado ninguna liquidación de viático.</p>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <NuevaLiquidacionModal
          onClose={() => setModal(false)}
          onCreado={(id) => { setModal(false); router.push(`/viaticos/entrega-formulario/${id}/imprimir`); }}
        />
      )}
    </div>
  );
}

function nuevaComision(): Comision { return { tipo: "", lugar: "" }; }

function NuevaLiquidacionModal({ onClose, onCreado }: { onClose: () => void; onCreado: (id: number) => void }) {
  const hoy = fechaGuatemala();
  const [comisiones, setComisiones] = useState<Comision[]>([nuevaComision()]);
  const [dias, setDias] = useState("");

  const [desayuno, setDesayuno] = useState(""); const [almuerzo, setAlmuerzo] = useState("");
  const [cena, setCena] = useState(""); const [hospedaje, setHospedaje] = useState("");
  const [otrosGastos, setOtrosGastos] = useState("");

  const [tieneAnticipo, setTieneAnticipo] = useState(false);
  const [recibidoVaNo, setRecibidoVaNo] = useState(""); const [recibidoVaMonto, setRecibidoVaMonto] = useState("");
  const [reintegro, setReintegro] = useState(""); const [complemento, setComplemento] = useState("");
  const [formaPago, setFormaPago] = useState(""); const [fechaPago, setFechaPago] = useState(hoy);

  const [persNombre, setPersNombre] = useState(""); const [persNit, setPersNit] = useState("");
  const [persCargo, setPersCargo] = useState(""); const [persGrupo, setPersGrupo] = useState("");
  const [persEmpleado, setPersEmpleado] = useState(""); const [persSueldo, setPersSueldo] = useState("");
  const [persCategoria, setPersCategoria] = useState("");
  const [partida, setPartida] = useState("");
  const [nombramientoNumero, setNombramientoNumero] = useState("");
  const [fechaNombramiento, setFechaNombramiento] = useState(hoy);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const num = (s: string) => s.trim() === "" ? null : parseFloat(s);

  const sumaGastos = (num(desayuno) ?? 0) + (num(almuerzo) ?? 0) + (num(cena) ?? 0) + (num(hospedaje) ?? 0);
  const totalGastos = sumaGastos + (parseFloat(otrosGastos) || 0);

  function updateComision(i: number, patch: Partial<Comision>) {
    setComisiones(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }
  function addComision() { if (comisiones.length < 4) setComisiones(prev => [...prev, nuevaComision()]); }
  function removeComision(i: number) { setComisiones(prev => prev.filter((_, idx) => idx !== i)); }

  async function handleGuardar() {
    const validComisiones = comisiones.filter(c => c.tipo.trim());
    if (validComisiones.length === 0) return setError("Indica al menos un tipo de comisión");
    const diasNum = parseInt(dias, 10);
    if (!(diasNum > 0)) return setError("El número de días debe ser mayor a cero");
    if (!persNombre.trim() || !persNit.trim() || !persCargo.trim() || !persEmpleado.trim()) {
      return setError("Los datos de la Persona Nombrada son obligatorios");
    }
    if (!formaPago.trim()) return setError("La forma de pago es obligatoria");
    if (totalGastos <= 0) return setError("Debe registrar al menos un gasto");

    setSaving(true); setError("");
    const res = await crearLiquidacion({
      comisiones: validComisiones, dias: diasNum,
      gasto_desayuno: num(desayuno), gasto_almuerzo: num(almuerzo), gasto_cena: num(cena), gasto_hospedaje: num(hospedaje),
      otros_gastos: parseFloat(otrosGastos) || 0,
      recibido_va_no: tieneAnticipo ? recibidoVaNo : "",
      recibido_va_monto: tieneAnticipo ? num(recibidoVaMonto) : null,
      reintegro: tieneAnticipo ? num(reintegro) : null,
      complemento: tieneAnticipo ? num(complemento) : null,
      forma_pago: formaPago, fecha_pago: fechaPago,
      persona_nombre: persNombre, persona_nit: persNit, persona_cargo: persCargo, persona_grupo: persGrupo,
      persona_no_empleado: persEmpleado, persona_sueldo: num(persSueldo), persona_categoria_puesto: persCategoria,
      partida_presupuestaria: partida, nombramiento_numero: nombramientoNumero, fecha_nombramiento: fechaNombramiento,
    });
    setSaving(false);
    if ("error" in res) return setError(res.error);
    onCreado(res.id);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">Nueva Liquidación de Viático (Formulario V-L)</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Tipo de Comisión / Lugar de Permanencia</p>
            {comisiones.length < 4 && (
              <button onClick={addComision} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
                <Plus className="w-3 h-3" /> Agregar
              </button>
            )}
          </div>
          <div className="space-y-2">
            {comisiones.map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input placeholder="Tipo de comisión" className="input col-span-6 text-xs"
                  value={c.tipo} onChange={e => updateComision(i, { tipo: e.target.value })} />
                <input placeholder="Lugar de permanencia" className="input col-span-5 text-xs"
                  value={c.lugar} onChange={e => updateComision(i, { lugar: e.target.value })} />
                <button onClick={() => removeComision(i)} className="col-span-1 p-1.5 text-gray-400 hover:text-red-600" disabled={comisiones.length === 1}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="w-32">
            <label className="label">No. de días</label>
            <input type="number" min="1" step="1" className="input" value={dias} onChange={e => setDias(e.target.value)} />
          </div>

          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider pt-1">Resumen de Gastos</p>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="label">Desayuno Q.</label><input type="number" min="0" step="0.01" className="input" value={desayuno} onChange={e => setDesayuno(e.target.value)} /></div>
            <div><label className="label">Almuerzo Q.</label><input type="number" min="0" step="0.01" className="input" value={almuerzo} onChange={e => setAlmuerzo(e.target.value)} /></div>
            <div><label className="label">Cena Q.</label><input type="number" min="0" step="0.01" className="input" value={cena} onChange={e => setCena(e.target.value)} /></div>
            <div><label className="label">Hospedaje Q.</label><input type="number" min="0" step="0.01" className="input" value={hospedaje} onChange={e => setHospedaje(e.target.value)} /></div>
          </div>
          <div>
            <label className="label">Otros gastos (según comprobantes y planilla adjuntos) Q.</label>
            <input type="number" min="0" step="0.01" className="input" value={otrosGastos} onChange={e => setOtrosGastos(e.target.value)} />
          </div>
          <p className="text-sm text-gray-600">Total de gastos: <strong className="text-green-700 font-mono">{Q(totalGastos)}</strong></p>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Liquidación</p>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={tieneAnticipo} onChange={e => setTieneAnticipo(e.target.checked)} className="w-3.5 h-3.5 accent-brand-600" />
              Hubo anticipo (Formulario V-A)
            </label>
          </div>
          {tieneAnticipo && (
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">V-A No.</label><input className="input font-mono" value={recibidoVaNo} onChange={e => setRecibidoVaNo(e.target.value)} /></div>
              <div><label className="label">Monto recibido Q.</label><input type="number" step="0.01" className="input" value={recibidoVaMonto} onChange={e => setRecibidoVaMonto(e.target.value)} /></div>
              <div><label className="label">Reintegro (-) Q.</label><input type="number" step="0.01" className="input" value={reintegro} onChange={e => setReintegro(e.target.value)} /></div>
              <div className="col-span-3"><label className="label">Complemento a mi favor (+) Q.</label><input type="number" step="0.01" className="input" value={complemento} onChange={e => setComplemento(e.target.value)} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Forma de pago</label><input className="input" placeholder="Ej. Cheque 2212" value={formaPago} onChange={e => setFormaPago(e.target.value)} /></div>
            <div><label className="label">Fecha de pago</label><input type="date" className="input" value={fechaPago} onChange={e => setFechaPago(e.target.value)} /></div>
          </div>

          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider pt-1">Persona Nombrada</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><label className="label">Nombre</label><input className="input" value={persNombre} onChange={e => setPersNombre(e.target.value)} /></div>
            <div><label className="label">NIT</label><input className="input font-mono" value={persNit} onChange={e => setPersNit(e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Cargo</label><input className="input" value={persCargo} onChange={e => setPersCargo(e.target.value)} /></div>
            <div><label className="label">Grupo</label><input className="input" value={persGrupo} onChange={e => setPersGrupo(e.target.value)} /></div>
            <div><label className="label">No. Empleado</label><input className="input font-mono" value={persEmpleado} onChange={e => setPersEmpleado(e.target.value)} /></div>
            <div><label className="label">Sueldo Q.</label><input type="number" step="0.01" className="input" value={persSueldo} onChange={e => setPersSueldo(e.target.value)} /></div>
            <div><label className="label">Categoría de puesto</label><input className="input" value={persCategoria} onChange={e => setPersCategoria(e.target.value)} /></div>
            <div className="col-span-3"><label className="label">Número de partida presupuestaria</label><input className="input font-mono text-xs" value={partida} onChange={e => setPartida(e.target.value)} /></div>
          </div>

          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider pt-1">Nombramiento</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Nombramiento número</label><input className="input" value={nombramientoNumero} onChange={e => setNombramientoNumero(e.target.value)} /></div>
            <div><label className="label">Fecha</label><input type="date" className="input" value={fechaNombramiento} onChange={e => setFechaNombramiento(e.target.value)} /></div>
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
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Registrar y ver impresión
          </button>
        </div>
      </div>
    </div>
  );
}
