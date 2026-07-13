"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Palette, X, Loader2, Check, Sun, Moon, RotateCcw } from "lucide-react";
import { getMisPreferenciasUI, guardarPreferenciasUI } from "@/lib/preferencias-actions";
import {
  DEFAULT_PREFERENCIAS, TAMANO_LABELS,
  type PreferenciasUI, type TamanoLetra,
} from "@/lib/preferencias";

const PRESETS_BARRA = ["#111827", "#14532d", "#1e3a5f", "#3b0764", "#4c1d24", "#0f766e"];
const PRESETS_FONDO = ["#f3f4f6", "#eef2f7", "#f0fdf4", "#fefce8", "#faf5ff", "#fdf2f8"];
const PRESETS_MODULOS = ["#16a34a", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#0f766e"];

// Botón que abre el panel de personalización de interfaz. Se usa tanto en la
// barra superior de los módulos (variant="topbar") como en el header del
// launcher (variant="launcher").
export default function PersonalizacionButton({ variant = "topbar" }: { variant?: "topbar" | "launcher" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "topbar" ? (
        <button onClick={() => setOpen(true)} aria-label="Personalizar interfaz"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <Palette className="w-4 h-4" />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} aria-label="Personalizar interfaz"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-green-200 hover:text-white hover:bg-white/10 transition-colors border border-white/20">
          <Palette className="w-4 h-4" />
          <span className="hidden sm:inline">Personalizar</span>
        </button>
      )}
      {open && <PersonalizacionModal onClose={() => setOpen(false)} />}
    </>
  );
}

function PersonalizacionModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<PreferenciasUI | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getMisPreferenciasUI().then(setPrefs);
  }, []);

  function set<K extends keyof PreferenciasUI>(k: K, v: PreferenciasUI[K]) {
    setPrefs(p => p ? { ...p, [k]: v } : p);
  }

  async function handleGuardar() {
    if (!prefs) return;
    setSaving(true); setError("");
    const res = await guardarPreferenciasUI(prefs);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    router.refresh();
    onClose();
  }

  async function handleRestablecerTodo() {
    setPrefs({ ...DEFAULT_PREFERENCIAS });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Palette className="w-4 h-4" /> Personalizar interfaz
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        {!prefs ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
        ) : (
          <div className="px-5 py-4 space-y-5">
            {/* Tema */}
            <div>
              <label className="label">Tema</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => set("tema", "claro")}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${prefs.tema === "claro" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 bg-white text-gray-700 hover:border-brand-300"}`}>
                  <Sun className="w-4 h-4" /> Claro
                </button>
                <button type="button" onClick={() => set("tema", "oscuro")}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${prefs.tema === "oscuro" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 bg-white text-gray-700 hover:border-brand-300"}`}>
                  <Moon className="w-4 h-4" /> Oscuro
                </button>
              </div>
            </div>

            {/* Tamaño de letra */}
            <div>
              <label className="label">Tamaño de letra</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(TAMANO_LABELS) as TamanoLetra[]).map(t => (
                  <button key={t} type="button" onClick={() => set("tamano_letra", t)}
                    className={`p-2.5 rounded-xl border-2 font-medium transition-all ${prefs.tamano_letra === t ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 bg-white text-gray-700 hover:border-brand-300"}`}
                    style={{ fontSize: t === "pequena" ? "12px" : t === "grande" ? "16px" : "14px" }}>
                    {TAMANO_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <ColorField
              label="Color de la barra lateral"
              descripcion="También colorea el encabezado del menú de módulos. Elige colores oscuros para que el texto blanco se lea bien."
              value={prefs.color_barra}
              presets={PRESETS_BARRA}
              onChange={v => set("color_barra", v)}
            />
            <ColorField
              label="Color del fondo"
              descripcion="Fondo del launcher y del área de trabajo de los módulos."
              value={prefs.color_fondo}
              presets={PRESETS_FONDO}
              onChange={v => set("color_fondo", v)}
            />
            <ColorField
              label="Color de los módulos"
              descripcion="Botones, barrita superior de cada tarjeta y elemento activo del menú."
              value={prefs.color_modulos}
              presets={PRESETS_MODULOS}
              onChange={v => set("color_modulos", v)}
            />

            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={handleRestablecerTodo} disabled={!prefs}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40">
            <RotateCcw className="w-3.5 h-3.5" /> Restablecer todo
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            <button onClick={handleGuardar} disabled={saving || !prefs} className="btn-primary disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, descripcion, value, presets, onChange }: {
  label: string; descripcion: string; value: string | null;
  presets: string[]; onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label mb-0">{label}</label>
        {value && (
          <button type="button" onClick={() => onChange(null)}
            className="text-[11px] font-medium text-gray-400 hover:text-gray-600">
            Restablecer
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mb-2">{descripcion}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {presets.map(c => (
          <button key={c} type="button" onClick={() => onChange(c)}
            aria-label={`Color ${c}`}
            className={`w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 ${value === c ? "border-gray-900 ring-2 ring-offset-1 ring-gray-300" : "border-gray-200"}`}
            style={{ backgroundColor: c }} />
        ))}
        <label className={`relative w-7 h-7 rounded-lg border-2 cursor-pointer overflow-hidden transition-transform hover:scale-110 ${value && !presets.includes(value) ? "border-gray-900 ring-2 ring-offset-1 ring-gray-300" : "border-gray-200"}`}
          style={{ background: value && !presets.includes(value) ? value : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}>
          <input type="color" value={value ?? "#888888"} onChange={e => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Color personalizado" />
        </label>
        <span className="text-[11px] text-gray-400 ml-1 font-mono">{value ?? "por defecto"}</span>
      </div>
    </div>
  );
}
