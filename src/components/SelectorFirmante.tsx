"use client";

export type Firmante = { id: number; nombre: string; cargo: string };

// Selector de firmante para la barra "no-print" de un documento impreso —
// reemplaza los nombres fijos que antes venían hardcodeados o de un campo
// único de Configuración (ej. "Lilia Zucely Pérez Fuentes", que ya no
// trabaja en la unidad). El super administrador mantiene la lista en
// Configuración → Firmantes; aquí solo se elige cuál va en esta impresión.
export default function SelectorFirmante({
  label, firmantes, value, onChange,
}: {
  label: string; firmantes: Firmante[]; value: Firmante | null; onChange: (f: Firmante | null) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      {label}:
      <select
        className="input py-1 text-sm w-64"
        value={value?.id ?? ""}
        onChange={e => onChange(firmantes.find(f => f.id === Number(e.target.value)) ?? null)}
      >
        <option value="">— Selecciona —</option>
        {firmantes.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
      </select>
    </label>
  );
}
