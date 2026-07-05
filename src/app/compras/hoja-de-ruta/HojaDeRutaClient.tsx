"use client";
import { useState } from "react";
import {
  Route, Search, Loader2, FileText, Layers, Gavel, ShoppingCart,
  XCircle, ChevronDown, ChevronRight,
} from "lucide-react";
import { buscarHojaDeRuta, type HojaDeRuta } from "@/lib/hoja-de-ruta-actions";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function resumenEstado(h: HojaDeRuta): { texto: string; tono: "gray" | "green" | "red" | "amber" | "blue" } {
  if (h.orden) return { texto: `Orden de Compra generada (${h.orden.numero}/${h.orden.anio})`, tono: "green" };

  if (h.acta) {
    if (h.acta.estado === "Rechazada") return { texto: "Acta rechazada — esperando corrección en Junta Adjudicadora/Acta", tono: "red" };
    if (h.acta.estado === "Aprobada") return { texto: "Acta aprobada — esperando Completar Adjudicación en Compras/Adjudicación", tono: "blue" };
    return { texto: "Acta generada — esperando previsualización y aprobación en Junta Adjudicadora/Acta", tono: "amber" };
  }

  if (h.consolidacion) {
    const c = h.consolidacion;
    if (c.estado === "Rechazado por Junta") return { texto: "Rechazado por la Junta Adjudicadora — esperando corrección en Compras/Adjudicación", tono: "red" };
    if (c.estado === "Adjudicado") return { texto: "Adjudicado — esperando generar el Acta en Junta Adjudicadora/Acta", tono: "blue" };
    if (c.estado === "Enviado a Junta") return { texto: "Enviado a Junta Adjudicadora — esperando revisión", tono: "amber" };
    if (c.estado === "Enviado a Fondo Rotativo") return { texto: "En bandeja de Fondo Rotativo — esperando generar la orden", tono: "blue" };
    if (c.estado === "Enviado a Presupuesto") return { texto: "En bandeja de Presupuesto — esperando generar la orden", tono: "blue" };
    return { texto: "En Compras/Adjudicación — pendiente iniciar la adjudicación", tono: "amber" };
  }

  if (h.siaf.estado === "Rechazado") return { texto: "Rechazado — esperando corrección en Compras/A-01 SIAF", tono: "red" };
  if (h.siaf.estado === "Aprobado") return { texto: "Aprobado — esperando consolidarse en Compras/Consolidación", tono: "blue" };
  return { texto: "Borrador — pendiente de aprobar en Compras/A-01 SIAF", tono: "gray" };
}

const TONO_CLASSES: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700",
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700",
};

export default function HojaDeRutaClient() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HojaDeRuta[] | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function handleBuscar() {
    if (!query.trim()) return;
    setLoading(true);
    const res = await buscarHojaDeRuta(query.trim());
    setLoading(false);
    setResults(res);
    setExpandedId(res.length === 1 ? res[0].siaf.id : null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Route className="w-5 h-5" /> Hoja de Ruta
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Busca cualquier SIAF u orden por correlativo, Pre-Orden, razón de adjudicación, proveedor o insumo,
          y mira en qué etapa está o dónde se quedó — sin que ocupe espacio en tus pantallas de trabajo.
        </p>
      </div>

      <div className="flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Ej. 45/2026, Pre-Orden 1023, NIT del proveedor…"
            value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleBuscar()} />
        </div>
        <button onClick={handleBuscar} disabled={loading || !query.trim()} className="btn-primary disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
        </button>
      </div>

      {results != null && (
        <div className="space-y-3">
          {results.length === 0 && (
            <div className="card p-10 text-center text-gray-400">
              <Route className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No se encontró ninguna solicitud con ese criterio.</p>
            </div>
          )}
          {results.map(h => {
            const resumen = resumenEstado(h);
            const expanded = expandedId === h.siaf.id;
            const correlativo = h.consolidacion?.numero_adjudicacion
              ? `ADJ-${h.consolidacion.numero_adjudicacion}`
              : h.consolidacion?.pre_orden ? `PRE-${h.consolidacion.pre_orden}` : `SIAF ${h.siaf.numero}/${h.siaf.anio}`;

            return (
              <div key={h.siaf.id} className="card overflow-hidden">
                <button onClick={() => setExpandedId(p => p === h.siaf.id ? null : h.siaf.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                  {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-bold text-gray-900">{correlativo}</p>
                    <p className="text-xs text-gray-400">SIAF {h.siaf.numero}/{h.siaf.anio} · creado {h.siaf.fecha}
                      {h.siaf.creado_por_nombre && <> por {h.siaf.creado_por_nombre}</>}
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${TONO_CLASSES[resumen.tono]}`}>
                    {resumen.texto}
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                    {/* Paso 1: SIAF */}
                    <Paso icon={FileText} titulo={`SIAF ${h.siaf.numero}/${h.siaf.anio}`} activo>
                      <p className="text-xs text-gray-500">Fecha: {h.siaf.fecha} {h.siaf.creado_por_nombre && `· Creado por ${h.siaf.creado_por_nombre}`}</p>
                      {h.siaf.observaciones && <p className="text-xs text-gray-500">Justificación: {h.siaf.observaciones}</p>}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {h.siaf.items.map(i => (
                          <span key={i.id} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                            {i.nombre} ({i.cantidad_solicitada.toLocaleString("es-GT")})
                          </span>
                        ))}
                      </div>
                      {h.siaf.estado === "Rechazado" && (
                        <RechazoBox motivo={h.siaf.motivo_rechazo} por={h.siaf.rechazado_por_nombre} en={h.siaf.rechazado_en} />
                      )}
                    </Paso>

                    {/* Paso 2: Consolidación */}
                    {h.consolidacion ? (
                      <Paso icon={Layers} titulo={`Consolidación — Pre-Orden ${h.consolidacion.pre_orden ?? "—"}`} activo>
                        <p className="text-xs text-gray-500">
                          Tipo: {h.consolidacion.tipo_compra ?? "—"} · Estado: {h.consolidacion.estado}
                        </p>
                        {h.consolidacion.proveedor_nombre && (
                          <p className="text-xs text-gray-500">
                            Proveedor: {h.consolidacion.proveedor_nombre} {h.consolidacion.proveedor_nit && `(NIT: ${h.consolidacion.proveedor_nit})`}
                            {h.consolidacion.total != null && <> · Total: {Q(h.consolidacion.total)}</>}
                          </p>
                        )}
                        {h.consolidacion.numero_adjudicacion && (
                          <p className="text-xs text-gray-500">Razón de adjudicación: {h.consolidacion.numero_adjudicacion}</p>
                        )}
                        {h.consolidacion.numero_a04 && (
                          <p className="text-xs text-gray-500">N° A-04 SIAF: {h.consolidacion.numero_a04}/{h.consolidacion.anio_a04}</p>
                        )}
                        {h.consolidacion.estado === "Rechazado por Junta" && (
                          <RechazoBox motivo={h.consolidacion.motivo_rechazo} por={h.consolidacion.rechazado_por_nombre} en={h.consolidacion.rechazado_en} />
                        )}
                      </Paso>
                    ) : (
                      <Paso icon={Layers} titulo="Consolidación" activo={false}>
                        <p className="text-xs text-gray-400">Aún no se ha consolidado.</p>
                      </Paso>
                    )}

                    {/* Paso 3: Acta */}
                    {h.acta ? (
                      <Paso icon={Gavel} titulo={`Acta ${h.acta.no_acta}`} activo>
                        <p className="text-xs text-gray-500">Formulario: {h.acta.no_formulario} · Estado: {h.acta.estado}</p>
                        {h.acta.estado === "Rechazada" && (
                          <RechazoBox motivo={h.acta.motivo_rechazo} por={null} en={null} />
                        )}
                      </Paso>
                    ) : (
                      <Paso icon={Gavel} titulo="Acta de Junta Adjudicadora" activo={false}>
                        <p className="text-xs text-gray-400">Aún no se ha generado.</p>
                      </Paso>
                    )}

                    {/* Paso 4: Orden de compra */}
                    {h.orden ? (
                      <Paso icon={ShoppingCart} titulo={`Orden de Compra ${h.orden.numero}/${h.orden.anio}`} activo>
                        <p className="text-xs text-gray-500">Fecha: {h.orden.fecha} · Estado: {h.orden.estado}</p>
                      </Paso>
                    ) : (
                      <Paso icon={ShoppingCart} titulo="Orden de Compra" activo={false}>
                        <p className="text-xs text-gray-400">Aún no se ha generado.</p>
                      </Paso>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Paso({ icon: Icon, titulo, activo, children }: {
  icon: React.ComponentType<{ className?: string }>; titulo: string; activo: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${activo ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-400"}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <p className={`text-sm font-semibold ${activo ? "text-gray-900" : "text-gray-400"}`}>{titulo}</p>
        <div className="mt-0.5 space-y-1">{children}</div>
      </div>
    </div>
  );
}

function RechazoBox({ motivo, por, en }: { motivo: string | null; por: string | null; en: string | null }) {
  return (
    <div className="mt-1.5 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
      <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <div>
        <p>{motivo || "Sin motivo registrado"}</p>
        {(por || en) && <p className="text-red-500 mt-0.5">{por && `Rechazado por ${por}`} {en && `· ${en}`}</p>}
      </div>
    </div>
  );
}
