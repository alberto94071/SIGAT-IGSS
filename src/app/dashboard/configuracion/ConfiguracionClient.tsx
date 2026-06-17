"use client";
import { useState } from "react";
import { Settings, Save, Check } from "lucide-react";
import { guardarConfiguracion } from "./actions";

type Config = {
  id: number;
  nombre_unidad: string;
  codigo_unidad: string;
  codigo_contable: string;
  municipio: string;
  monto_fondo_rotativo: string;
  efectivo_caja: string;
  ejercicio_fiscal: number;
  nombre_responsable: string;
  numero_empleado_resp: string;
  nombre_solicitante: string;
  numero_empleado_sol: string;
  resolucion_fondo: string;
};

export default function ConfiguracionClient({ config: init }: { config: Config }) {
  const [form,    setForm]    = useState(init);
  const [loading, setLoading] = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  function set(k: keyof Config, v: string | number) {
    setForm(prev => ({ ...prev, [k]: v }));
    setSaved(false);
  }

  async function handleSave() {
    setLoading(true); setError("");
    const res = await guardarConfiguracion(form);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const Field = ({ label, k, type = "text" }: { label: string; k: keyof Config; type?: string }) => (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        value={String(form[k] ?? "")}
        onChange={e => set(k, type === "number" ? Number(e.target.value) : e.target.value)}
      />
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
          {saved ? <><Check className="w-4 h-4" /> Guardado</> : <><Save className="w-4 h-4" /> {loading ? "Guardando..." : "Guardar cambios"}</>}
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
          <Field label="Monto inicial del fondo (Q)" k="monto_fondo_rotativo" type="number" />
          <Field label="Efectivo en caja (Q)" k="efectivo_caja" type="number" />
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
    </div>
  );
}
