"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Plus, Trash2, Printer, Loader2, AlertTriangle, Inbox } from "lucide-react";
import { fechaGuatemala } from "@/lib/date-utils";
import { agregarRecepcion, eliminarRecepcion, type DatosRecepcion } from "./actions";

type Recepcion = { id: number; fecha: string; cantidad: number; detalle: string | null; created_at: string | null };

export default function LibrosClient({ recepciones: init }: { recepciones: Recepcion[] }) {
  const router = useRouter();
  const [recepciones, setRecepciones] = useState(init);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5" /> Libros
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Libro de Control, Existencia, Uso y Entrega de Formularios de Viáticos — para enviar a la DAF.
        </p>
      </div>

      <GenerarLibroPanel />
      <RecepcionesPanel recepciones={recepciones} setRecepciones={setRecepciones} router={router} />
    </div>
  );
}

function GenerarLibroPanel() {
  const hoy = fechaGuatemala();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [existencia, setExistencia] = useState("");
  const [folio, setFolio] = useState("");

  const href = mes
    ? `/viaticos/libros/imprimir/${mes}?existencia=${encodeURIComponent(existencia || "0")}&folio=${encodeURIComponent(folio)}`
    : "";

  return (
    <div className="card p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-900">Generar Libro del mes</p>
      <p className="text-xs text-gray-500">
        Se genera un Libro por mes — elegí el mes y la existencia de formularios en blanco que había al empezarlo (la del recibo físico de talonarios, no la calcula el sistema).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-[auto_auto_1fr_auto] gap-3 items-end">
        <div>
          <label className="label">Mes</label>
          <input type="month" className="input" value={mes} onChange={e => setMes(e.target.value)} />
        </div>
        <div>
          <label className="label">Existencia inicial</label>
          <input type="number" min={0} step="1" className="input w-32" value={existencia} onChange={e => setExistencia(e.target.value)} />
        </div>
        <div>
          <label className="label">No. de Folio (opcional)</label>
          <input className="input" value={folio} onChange={e => setFolio(e.target.value)} />
        </div>
        {href ? (
          <Link href={href}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors">
            <Printer className="w-4 h-4" /> Generar
          </Link>
        ) : (
          <button disabled className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 text-gray-400">
            <Printer className="w-4 h-4" /> Generar
          </button>
        )}
      </div>
    </div>
  );
}

function RecepcionesPanel({ recepciones, setRecepciones, router }: {
  recepciones: Recepcion[]; setRecepciones: React.Dispatch<React.SetStateAction<Recepcion[]>>;
  router: ReturnType<typeof useRouter>;
}) {
  const [fecha, setFecha] = useState(fechaGuatemala());
  const [cantidad, setCantidad] = useState("");
  const [detalle, setDetalle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalRecibido = useMemo(() => recepciones.reduce((s, r) => s + r.cantidad, 0), [recepciones]);

  async function handleAgregar() {
    setSaving(true); setError("");
    const datos: DatosRecepcion = { fecha, cantidad: Number(cantidad) || 0, detalle };
    const res = await agregarRecepcion(datos);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    setCantidad(""); setDetalle("");
    router.refresh();
    setRecepciones(prev => [{ id: -Date.now(), fecha, cantidad: datos.cantidad, detalle: detalle.trim() || null, created_at: null }, ...prev]);
  }

  async function handleEliminar(id: number) {
    await eliminarRecepcion(id);
    setRecepciones(prev => prev.filter(r => r.id !== id));
    router.refresh();
  }

  return (
    <div className="card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">Recepción de formularios</p>
        <p className="text-xs text-gray-500">
          Registrá acá cada vez que Tesorería/Guatecompras les manda un lote nuevo de talonarios V-A/V-C/V-L en blanco — el Libro del mes correspondiente lo suma solo a la existencia.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[auto_auto_1fr_auto] gap-2 items-end">
        <div>
          <label className="label">Fecha</label>
          <input type="date" className="input" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div>
          <label className="label">Cantidad recibida</label>
          <input type="number" min={0} step="1" className="input w-28" value={cantidad} onChange={e => setCantidad(e.target.value)} />
        </div>
        <div>
          <label className="label">Detalle (opcional)</label>
          <input className="input" placeholder="Ej. talonarios 1077-1226" value={detalle} onChange={e => setDetalle(e.target.value)} />
        </div>
        <button onClick={handleAgregar} disabled={saving || !(Number(cantidad) > 0) || !fecha}
          className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <div className="border-t border-gray-100 pt-3">
        {recepciones.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Inbox className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
            <p className="text-xs">Todavía no registrás ninguna recepción.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recepciones.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
                <div className="min-w-0 flex items-center gap-3">
                  <span className="text-gray-500 whitespace-nowrap">{r.fecha}</span>
                  <span className="font-mono font-bold text-gray-900">{r.cantidad}</span>
                  {r.detalle && <span className="text-gray-500 truncate">{r.detalle}</span>}
                </div>
                <button onClick={() => handleEliminar(r.id)} className="p-1 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <p className="text-xs text-gray-400 pt-1">Total recibido: {totalRecibido}</p>
          </div>
        )}
      </div>
    </div>
  );
}
