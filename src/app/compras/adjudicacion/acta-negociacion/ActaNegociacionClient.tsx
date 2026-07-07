"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Printer, Loader2, Save } from "lucide-react";
import { guardarActaNegociacion } from "@/lib/adjudicacion/actas-actions";

type Acta = { anio: number; contenido: string | null; archivo_url: string | null } | null;

interface Props { anio: number; acta: Acta; isSuperAdmin: boolean; }

export default function ActaNegociacionClient({ anio, acta, isSuperAdmin }: Props) {
  const router = useRouter();
  const [contenido, setContenido] = useState(acta?.contenido ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleGuardar() {
    setSaving(true); setError(""); setSaved(false);
    const res = await guardarActaNegociacion(anio, { contenido });
    setSaving(false);
    if ("error" in res) return setError(res.error);
    setSaved(true);
    router.refresh();
  }

  function cambiarAnio(nuevoAnio: number) {
    router.push(`/compras/adjudicacion/acta-negociacion?anio=${nuevoAnio}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Acta de Negociación
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Plantilla fija por año — se reimprime igual para cada compra Regularizado de ese año.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-auto" value={anio} onChange={e => cambiarAnio(Number(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <a href={`/compras/adjudicacion/acta-negociacion/imprimir/${anio}`}
            className="btn-secondary">
            <Printer className="w-4 h-4" /> Imprimir
          </a>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <label className="label">Contenido del Acta {anio}</label>
        <textarea
          className="input min-h-[320px] text-sm"
          placeholder="Redacta aquí el texto del Acta de Negociación para este año…"
          value={contenido}
          onChange={e => setContenido(e.target.value)}
          disabled={!isSuperAdmin}
        />
        {!isSuperAdmin && (
          <p className="text-xs text-gray-400">Solo el superadmin puede editar el Acta de Negociación.</p>
        )}
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        {saved && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Guardado.</div>}
        {isSuperAdmin && (
          <button onClick={handleGuardar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
          </button>
        )}
      </div>
    </div>
  );
}
