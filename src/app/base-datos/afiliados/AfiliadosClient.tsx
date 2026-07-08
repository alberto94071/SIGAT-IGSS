"use client";
import { useState, useEffect, useRef } from "react";
import { Users2, Search, Loader2 } from "lucide-react";
import { buscarAfiliados } from "@/lib/afiliados-actions";

type Afiliado = {
  id: number; afiliacion: string; dpi: string | null; nombre: string; calidad: string | null;
  edad: number | null; sexo: string | null; direccion: string | null; telefono: string | null;
  numero_patronal: string | null; patrono: string | null;
};

export default function AfiliadosClient({ total }: { total: number }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Afiliado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) { setResultados([]); return; }
    timer.current = setTimeout(async () => {
      setBuscando(true);
      const r = await buscarAfiliados(query.trim());
      setBuscando(false);
      setResultados(r as unknown as Afiliado[]);
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Users2 className="w-5 h-5 text-blue-600" /> Base de Afiliados
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString("es-GT")} afiliado(s) registrados — usada por Caja Chica/Solicitud Pasaje y cualquier otro módulo que necesite consultarla.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por número de afiliación, DPI o nombre…"
          value={query} onChange={e => setQuery(e.target.value)} />
        {buscando && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Afiliación</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">DPI</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Calidad</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Edad</th>
                <th className="px-4 py-3 text-left">Dirección</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Teléfono</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resultados.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-900 whitespace-nowrap">{a.afiliacion}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{a.dpi ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{a.nombre}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{a.calidad ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.edad ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.direccion ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{a.telefono ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {query.trim().length < 2 && (
            <div className="text-center py-16 text-gray-400 text-sm">Escribe al menos 2 caracteres para buscar.</div>
          )}
          {query.trim().length >= 2 && !buscando && resultados.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">Sin resultados.</div>
          )}
        </div>
      </div>
    </div>
  );
}
