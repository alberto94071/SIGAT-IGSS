"use client";
import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { buscarCotizacionAnualPorTexto } from "@/lib/adjudicacion/cotizaciones-actions";
import type { CotizacionAnual } from "@/lib/adjudicacion/types";

export default function CotizacionAnualAutocomplete({
  onSelect,
}: {
  onSelect: (cot: CotizacionAnual | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CotizacionAnual[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = query.trim();
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await buscarCotizacionAnualPorTexto(q);
        setResults(res);
      } catch (e) {
        setResults([]);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Ej. COT-03/2026 o Distribuidora Médica..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            onSelect(null);
          }}
          onFocus={() => {
            if (query.length >= 2) setOpen(true);
          }}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-600 animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto divide-y divide-gray-100">
          {results.map((r) => (
            <li
              key={r.id}
              onClick={() => {
                setQuery(r.numero);
                setOpen(false);
                onSelect(r);
              }}
              className="px-4 py-2 hover:bg-brand-50 cursor-pointer"
            >
              <div className="font-semibold text-gray-900 text-sm">{r.proveedor_nombre}</div>
              <div className="text-xs text-gray-500 font-mono mt-0.5">
                {r.numero} · {r.items.length} insumo(s)
              </div>
            </li>
          ))}
        </ul>
      )}
      
      {open && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm text-gray-500 text-center">
          No se encontraron cotizaciones.
        </div>
      )}
    </div>
  );
}
