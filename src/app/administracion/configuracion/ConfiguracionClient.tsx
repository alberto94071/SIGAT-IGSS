"use client";
import { useState } from "react";
import { Settings, Save, Check, Plus, Pencil, Trash2, X, UserCheck } from "lucide-react";
import { guardarConfiguracion } from "./actions";
import { crearFirmante, editarFirmante, eliminarFirmante, toggleFirmante } from "@/app/compras/a01-siaf/firmantes-actions";

type Config = {
  id: number;
  nombre_unidad: string; codigo_unidad: string; codigo_contable: string;
  municipio: string; monto_fondo_rotativo: number; efectivo_caja: number;
  ejercicio_fiscal: number; nombre_responsable: string; numero_empleado_resp: string;
  nombre_solicitante: string; numero_empleado_sol: string; resolucion_fondo: string;
  nombre_unidad_ejecutora?: string; centro_costo_nombre?: string;
  direccion_unidad?: string; justificacion_siaf?: string;
};
type Firmante = { id: number; nombre: string; cargo: string; activo: boolean };

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
  const [fSaving,      setFSaving]      = useState(false);

  function set(k: keyof Config, v: string | number) {
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
    setEditingF(null); setFNombre(""); setFCargo(""); setFModal(true);
  }
  function openEditFirmante(f: Firmante) {
    setEditingF(f); setFNombre(f.nombre); setFCargo(f.cargo); setFModal(true);
  }
  async function handleSaveFirmante() {
    if (!fNombre.trim() || !fCargo.trim()) return;
    setFSaving(true);
    if (editingF) {
      const res = await editarFirmante({ id: editingF.id, nombre: fNombre, cargo: fCargo });
      if (res.firmante) setFirmantes(p => p.map(f => f.id === editingF.id ? { ...f, ...res.firmante } : f));
    } else {
      const res = await crearFirmante({ nombre: fNombre, cargo: fCargo });
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
      </section>

      {/* Firmantes — solo superadmin */}
      {isSuperadmin && (
        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide flex items-center gap-2">
                <UserCheck className="w-4 h-4" /> Firmantes A-01 SIAF
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Personas que pueden firmar el formulario. Se seleccionan al imprimir.
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
                  <p className="text-xs text-gray-500">{f.cargo}</p>
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
