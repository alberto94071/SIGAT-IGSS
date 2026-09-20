"use client";
import { useState } from "react";
import { Settings, Save, Check, Plus, Pencil, Trash2, X, UserCheck } from "lucide-react";
import { guardarConfiguracion } from "./actions";
import { crearFirmante, editarFirmante, eliminarFirmante, toggleFirmante } from "@/app/compras/a01-siaf/firmantes-actions";

type Config = {
  id: number;
  nombre_unidad: string; codigo_unidad: string; codigo_contable: string; codigo_centro_costo: string;
  municipio: string; monto_fondo_rotativo: number; efectivo_caja: number;
  ejercicio_fiscal: number; nombre_responsable: string; numero_empleado_resp: string;
  nombre_solicitante: string; numero_empleado_sol: string; resolucion_fondo: string;
  nombre_unidad_ejecutora?: string; centro_costo_nombre?: string;
  direccion_unidad?: string; justificacion_siaf?: string;
  banco_nombre?: string; cuenta_numero?: string; cuenta_nombre?: string;
  siaf_compras_numero_inicial?: number; siaf_compras_numero_inicial_anio?: number;
  viatico_exigir_fecha_limite?: boolean;
  viatico_cuota_grupo_1_2?: number; viatico_cuota_grupo_3?: number;
  viatico_cuota_grupo_4?: number; viatico_cuota_grupo_5?: number;
};
type Firmante = {
  id: number; nombre: string; cargo: string; unidad: string | null;
  numero_empleado: string | null; nit: string | null;
  tratamiento: string | null; apellido: string | null; activo: boolean;
};

interface Props { config: Config; firmantes: Firmante[]; rol: string; }

export default function ConfiguracionClient({ config: init, firmantes: initFirmantes, rol }: Props) {
  const isSuperadmin = rol === "superadmin";

  // Config form
  const [form,    setForm]    = useState(init);
  const [loading, setLoading] = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  // Firmantes
  const [firmantes,    setFirmantes]    = useState<Firmante[]>(initFirmantes);
  const [fModal,       setFModal]       = useState(false);
  const [editingF,     setEditingF]     = useState<Firmante | null>(null);
  const [fNombre,      setFNombre]      = useState("");
  const [fCargo,       setFCargo]       = useState("");
  const [fUnidad,      setFUnidad]      = useState("");
  const [fNumEmpleado, setFNumEmpleado] = useState("");
  const [fNit,         setFNit]         = useState("");
  const [fTratamiento, setFTratamiento] = useState("");
  const [fApellido,    setFApellido]    = useState("");
  const [fSaving,      setFSaving]      = useState(false);

  function set(k: keyof Config, v: string | number | boolean) {
    setForm(prev => ({ ...prev, [k]: v }));
    setSaved(false);
  }

  async function handleSave() {
    setLoading(true); setError("");
    const res = await guardarConfiguracion(form);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  }

  function openNewFirmante() {
    setEditingF(null); setFNombre(""); setFCargo(""); setFUnidad(""); setFNumEmpleado(""); setFNit("");
    setFTratamiento(""); setFApellido(""); setFModal(true);
  }
  function openEditFirmante(f: Firmante) {
    setEditingF(f); setFNombre(f.nombre); setFCargo(f.cargo); setFUnidad(f.unidad ?? "");
    setFNumEmpleado(f.numero_empleado ?? ""); setFNit(f.nit ?? "");
    setFTratamiento(f.tratamiento ?? ""); setFApellido(f.apellido ?? ""); setFModal(true);
  }
  async function handleSaveFirmante() {
    if (!fNombre.trim() || !fCargo.trim()) return;
    setFSaving(true);
    if (editingF) {
      const res = await editarFirmante({
        id: editingF.id, nombre: fNombre, cargo: fCargo, unidad: fUnidad, numero_empleado: fNumEmpleado, nit: fNit,
        tratamiento: fTratamiento, apellido: fApellido,
      });
      if (res.firmante) setFirmantes(p => p.map(f => f.id === editingF.id ? { ...f, ...res.firmante } : f));
    } else {
      const res = await crearFirmante({
        nombre: fNombre, cargo: fCargo, unidad: fUnidad, numero_empleado: fNumEmpleado, nit: fNit,
        tratamiento: fTratamiento, apellido: fApellido,
      });
      if (res.firmante) setFirmantes(p => [...p, res.firmante as Firmante]);
    }
    setFSaving(false); setFModal(false);
  }
  async function handleDeleteFirmante(id: number) {
    if (!confirm("¿Eliminar este firmante?")) return;
    await eliminarFirmante(id);
    setFirmantes(p => p.filter(f => f.id !== id));
  }
  async function handleToggleFirmante(f: Firmante) {
    await toggleFirmante(f.id, !f.activo);
    setFirmantes(p => p.map(x => x.id === f.id ? { ...x, activo: !x.activo } : x));
  }

  const Field = ({ label, k, type = "text", helper }: { label: string; k: keyof Config; type?: string; helper?: string }) => (
    <div>
      <label className="label">{label}</label>
      <input
        className="input" type={type}
        value={String(form[k] ?? "")}
        onChange={e => set(k, type === "number" ? Number(e.target.value) : e.target.value)}
      />
      {helper && <p className="text-xs text-gray-400 mt-1">{helper}</p>}
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5" /> Configuración del sistema
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Datos institucionales que aparecen en todos los documentos
          </p>
        </div>
        <button onClick={handleSave} disabled={loading} className="btn-primary">
          {saved
            ? <><Check className="w-4 h-4" /> Guardado</>
            : <><Save className="w-4 h-4" /> {loading ? "Guardando…" : "Guardar cambios"}</>}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
      )}

      {/* Unidad */}
      <section className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Datos de la unidad</h2>
        <Field label="Nombre de la unidad ejecutora" k="nombre_unidad" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Código unidad ejecutora" k="codigo_unidad" />
          <Field label="Código contable" k="codigo_contable" />
        </div>
        <Field label="Código de Centro de Costo" k="codigo_centro_costo"
          helper="Se imprime siempre como Clave Administrativa en el DAB-60." />
        <Field label="Municipio / departamento" k="municipio" />
        <Field label="Ejercicio fiscal" k="ejercicio_fiscal" type="number" />
      </section>

      {/* Fondo */}
      <section className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Fondo rotativo</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Monto del fondo rotativo (Q)" k="monto_fondo_rotativo" type="number"
            helper="El techo autorizado por resolución para el fondo en el banco. No cambia con cada vale." />
          <Field label="Efectivo en caja (Q)" k="efectivo_caja" type="number"
            helper="Saldo líquido disponible ahora mismo para autorizar vales. Baja con cada cheque y sube con las boletas de depósito de liquidaciones." />
        </div>
        <Field label="Resolución del fondo" k="resolucion_fondo" />
      </section>

      {/* Cuenta bancaria — datos fijos que van siempre en el Voucher/Baucher impreso */}
      <section className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Cuenta bancaria (Voucher/Baucher)</h2>
        <Field label="Nombre del banco" k="banco_nombre" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Número de cuenta" k="cuenta_numero" />
          <Field label="Nombre de la cuenta" k="cuenta_nombre" />
        </div>
      </section>

      {/* Responsables */}
      <section className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Responsables</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre del responsable del FRI" k="nombre_responsable" />
          <Field label="N° empleado responsable" k="numero_empleado_resp" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre del solicitante" k="nombre_solicitante" />
          <Field label="N° empleado solicitante" k="numero_empleado_sol" />
        </div>
      </section>

      {/* Datos A-01 SIAF */}
      <section className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Forma A-01 SIAF</h2>
        <Field label="Nombre unidad ejecutora (encabezado del formulario)" k="nombre_unidad_ejecutora" />
        <div>
          <label className="label">Centro de costo (segunda línea del formulario)</label>
          <textarea className="input min-h-[60px] resize-none"
            value={String(form.centro_costo_nombre ?? "")}
            onChange={e => set("centro_costo_nombre", e.target.value)} />
        </div>
        <Field label="Dirección de la unidad" k="direccion_unidad" />
        <div>
          <label className="label">Texto de justificación</label>
          <textarea className="input min-h-[60px] resize-none"
            value={String(form.justificacion_siaf ?? "")}
            onChange={e => set("justificacion_siaf", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Correlativo de partida (último SIAF ya usado)" k="siaf_compras_numero_inicial" type="number"
            helper='Si la unidad ya venía llevando SIAF fuera del sistema, poné el último número usado (ej. 105) y el siguiente que genere el sistema será 106. Dejalo en 0 si no aplica.' />
          <Field label="Año de ese correlativo" k="siaf_compras_numero_inicial_anio" type="number"
            helper="Solo cuenta para este año; el que viene arranca en 1 de nuevo." />
        </div>
      </section>

      {/* Viáticos */}
      <section className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Viáticos</h2>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-brand-600"
            checked={form.viatico_exigir_fecha_limite ?? true}
            onChange={e => set("viatico_exigir_fecha_limite", e.target.checked)} />
          <span className="text-sm text-gray-700">
            Exigir el plazo de 10 días hábiles para registrar/enviar comisiones
            <span className="block text-xs text-gray-400 mt-0.5">
              Desmarcá esto solo temporalmente (ej. para poner al día viáticos atrasados) — el colaborador podrá
              registrar y enviar comisiones aunque ya venció el plazo. Volvé a marcarlo cuando terminen de ponerse al día.
            </span>
          </span>
        </label>
        <div>
          <p className="text-sm text-gray-700 font-medium">Cuota diaria de viático por grupo (Q)</p>
          <p className="text-xs text-gray-400 mt-0.5 mb-2">
            No todos cobran el mismo viático — depende del grupo del empleado (Administración → Colaboradores). El precio
            de cada servicio (desayuno/almuerzo/cena/hospedaje) sale de repartir esta cuota diaria en 15%/20%/15%/50%.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Grupos 1 y 2" k="viatico_cuota_grupo_1_2" type="number" />
            <Field label="Grupo 3" k="viatico_cuota_grupo_3" type="number" />
            <Field label="Grupo 4" k="viatico_cuota_grupo_4" type="number" />
            <Field label="Grupo 5" k="viatico_cuota_grupo_5" type="number" />
          </div>
        </div>
      </section>

      {/* Firmantes — solo superadmin */}
      {isSuperadmin && (
        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide flex items-center gap-2">
                <UserCheck className="w-4 h-4" /> Firmantes
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Personas que pueden firmar documentos (A-01 SIAF, Viáticos, Vale de Caja Chica, Acta, FRI...). Se seleccionan al imprimir.
              </p>
            </div>
            <button onClick={openNewFirmante} className="btn-primary text-xs py-1.5 px-3">
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          </div>

          {firmantes.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No hay firmantes configurados aún.
            </p>
          )}

          <div className="space-y-2">
            {firmantes.map(f => (
              <div key={f.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${f.activo ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{f.nombre}</p>
                  <p className="text-xs text-gray-500">{f.cargo}{f.unidad ? ` — ${f.unidad}` : ""}</p>
                  {(f.numero_empleado || f.nit) && (
                    <p className="text-xs text-gray-400">
                      {f.numero_empleado ? `No. Empleado: ${f.numero_empleado}` : ""}{f.numero_empleado && f.nit ? " · " : ""}{f.nit ? `NIT: ${f.nit}` : ""}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {f.activo ? "Activo" : "Inactivo"}
                </span>
                <button onClick={() => handleToggleFirmante(f)}
                  className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors text-xs">
                  {f.activo ? "Desactivar" : "Activar"}
                </button>
                <button onClick={() => openEditFirmante(f)}
                  className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDeleteFirmante(f.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modal firmante */}
      {fModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                {editingF ? "Editar firmante" : "Nuevo firmante"}
              </h2>
              <button onClick={() => setFModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="label">Nombre completo</label>
                <input className="input" placeholder="JUAN PÉREZ LÓPEZ"
                  value={fNombre} onChange={e => setFNombre(e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="label">Cargo / título</label>
                <input className="input" placeholder='Analista "A"'
                  value={fCargo} onChange={e => setFCargo(e.target.value)} />
              </div>
              <div>
                <label className="label">Unidad / oficina (opcional)</label>
                <input className="input" placeholder="Ej. U.I.A.A.D.D.M. en el Municipio de Tejutla"
                  value={fUnidad} onChange={e => setFUnidad(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">Se imprime como tercera línea bajo el nombre y cargo en la Forma A-04 SIAF, si se llena.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">No. de Empleado (opcional)</label>
                  <input className="input" value={fNumEmpleado} onChange={e => setFNumEmpleado(e.target.value)} />
                </div>
                <div>
                  <label className="label">NIT (opcional)</label>
                  <input className="input" value={fNit} onChange={e => setFNit(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-2">Solo hace falta llenar esto si el firmante va a poder elegirse en el Vale de Caja Chica.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tratamiento (opcional)</label>
                  <input className="input" placeholder='Licenciado' value={fTratamiento} onChange={e => setFTratamiento(e.target.value)} />
                </div>
                <div>
                  <label className="label">Apellido para saludo (opcional)</label>
                  <input className="input" placeholder="Monterroso Juárez" value={fApellido} onChange={e => setFApellido(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-2">
                Solo hace falta llenar esto si el firmante va a poder elegirse como destinatario de la Justificación de
                Estancia de Viáticos — arma la etiqueta "Licenciado:" y el saludo "Licenciado {"{apellido}"}:".
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setFModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSaveFirmante} disabled={fSaving || !fNombre.trim() || !fCargo.trim()}
                className="btn-primary">
                {fSaving ? "Guardando…" : <><Check className="w-4 h-4" /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
