"use client";
import { useEffect, useRef, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { buscarProveedoresAuto } from "@/lib/adjudicacion/actions";

type ProveedorHit = { id: number; nit: string | null; nombre: string; telefono: string | null };

interface Props {
  value: string;
  onChange: (nit: string) => void;
  onSelect: (p: ProveedorHit) => void;
  placeholder?: string;
}

// Autocompletado de NIT: busca en vivo (por NIT o nombre) contra la tabla de
// proveedores de la Base de Datos Central conforme el usuario va escribiendo.
export default function NitAutocomplete({ value, onChange, onSelect, placeholder }: Props) {
  const [results, setResults] = useState<ProveedorHit[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await buscarProveedoresAuto(q);
      if (active) { setResults(r); setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const showDropdown = open && value.trim().length >= 2 && (loading || results.length > 0);

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          className="input pl-8 font-mono text-sm"
          placeholder={placeholder ?? "NIT o nombre del proveedor…"}
          value={value}
          autoComplete="off"
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />}
      </div>
      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">Sin coincidencias en el catálogo de proveedores.</p>
          )}
          {results.map(p => (
            <button key={p.id} type="button"
              onMouseDown={() => { onSelect(p); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-brand-50 border-b border-gray-50 last:border-0 transition-colors">
              <p className="text-sm font-medium text-gray-900 truncate">{p.nombre}</p>
              <p className="text-xs text-gray-400 font-mono">{p.nit || "sin NIT"}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
