"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Route, Search, FileText, Layers, Gavel, ShoppingCart, Printer,
  XCircle, ChevronDown, ChevronRight, Wallet,
} from "lucide-react";
import type { HojaDeRuta } from "@/lib/hoja-de-ruta-actions";
import { resumenEstado, type Tono } from "@/lib/hoja-de-ruta-utils";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TONO_CLASSES: Record<Tono, string> = {
  gray: "bg-gray-100 text-gray-700",
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700",
};

function coincide(h: HojaDeRuta, q: string): boolean {
  const c = h.consolidacion;
  const campos = [
    `${h.siaf.numero}/${h.siaf.anio}`, h.siaf.numero.toString(),
    c?.pre_orden, c?.numero_adjudicacion, c?.proveedor_nombre, c?.proveedor_nit,
    h.orden ? `${h.orden.numero}/${h.orden.anio}` : null,
    ...h.siaf.items.map(i => i.nombre),
  ];
  return campos.some(campo => campo != null && campo.toLowerCase().includes(q));
}

export default function HojaDeRutaClient({ registros }: { registros: HojaDeRuta[] }) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const q = query.toLowerCase().trim();
  const results = useMemo(() => !q ? registros : registros.filter(h => coincide(h, q)), [registros, q]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Route className="w-5 h-5" /> Hoja de Ruta
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Aquí ves todo lo que se ha hecho — {registros.length} solicitud(es) en total. Busca por correlativo,
          Pre-Orden, razón de adjudicación, proveedor o insumo para encontrar un caso puntual, o simplemente
          recorre la lista completa para ver en qué etapa va cada una y volver a imprimir sus documentos.
        </p>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Ej. 45/2026, Pre-Orden 1023, NIT del proveedor…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="space-y-3">
          {results.length === 0 && (
            <div className="card p-10 text-center text-gray-400">
              <Route className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{registros.length === 0 ? "Aún no hay solicitudes registradas." : "No se encontró ninguna solicitud con ese criterio."}</p>
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
                  <div className="border-t border-gray-100 px-5 py-4 space-y-4" onClick={e => e.stopPropagation()}>
                    {/* Solo se muestran los pasos por los que el caso YA pasó — nada de
                        placeholders para etapas futuras o rutas que nunca tomó. */}

                    {/* Paso: SIAF */}
                    <Paso icon={FileText} titulo={`SIAF ${h.siaf.numero}/${h.siaf.anio}`}
                      accion={<PrintLink href={`/compras/a01-siaf/${h.siaf.id}/imprimir?firmantes=`} label="Imprimir A-01 SIAF" />}>
                      <p className="text-xs text-gray-500">Fecha: {h.siaf.fecha} {h.siaf.creado_por_nombre && `· Creado por ${h.siaf.creado_por_nombre}`}</p>
                      {h.siaf.observaciones && <p className="text-xs text-gray-500">Justificación: {h.siaf.observaciones}</p>}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {h.siaf.items.map(i => (
                          <span key={i.id} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                            {i.nombre} · Renglón {i.renglon ?? "—"} ({i.cantidad_solicitada.toLocaleString("es-GT")})
                          </span>
                        ))}
                      </div>
                      {h.siaf.estado === "Rechazado" && (
                        <RechazoBox motivo={h.siaf.motivo_rechazo} por={h.siaf.rechazado_por_nombre} en={h.siaf.rechazado_en} />
                      )}
                    </Paso>

                    {/* Paso: Consolidación */}
                    {h.consolidacion && (
                      <Paso icon={Layers} titulo={`Consolidación — Pre-Orden ${h.consolidacion.pre_orden ?? "—"}`}>
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
                        {h.consolidacion.cotizacion_anual_id && (
                          <p className="text-xs text-gray-500">Cotización anual: {h.consolidacion.referencia ?? "—"}</p>
                        )}
                        {h.consolidacion.estado === "Rechazado por Junta" && (
                          <RechazoBox motivo={h.consolidacion.motivo_rechazo} por={h.consolidacion.rechazado_por_nombre} en={h.consolidacion.rechazado_en} />
                        )}
                      </Paso>
                    )}

                    {/* Paso: Acta (solo si esta consolidación pasó por Junta Adjudicadora) */}
                    {h.acta && (
                      <Paso icon={Gavel} titulo={`Acta ${h.acta.no_acta}`}
                        accion={<PrintLink href={`/junta-adjudicadora/acta/${h.acta.id}/imprimir`} label="Ver / Imprimir Acta" />}>
                        <p className="text-xs text-gray-500">Formulario: {h.acta.no_formulario} · Estado: {h.acta.estado}</p>
                        {h.acta.estado === "Rechazada" && (
                          <RechazoBox motivo={h.acta.motivo_rechazo} por={null} en={null} />
                        )}
                      </Paso>
                    )}

                    {/* Paso: SIAF-04 (solo si ya se generó, camino de Fondo Rotativo) */}
                    {h.consolidacion?.numero_a04 != null && (
                      <Paso icon={FileText} titulo={`SIAF-04 ${h.consolidacion.numero_a04}/${h.consolidacion.anio_a04}`}
                        accion={<PrintLink href={`/compras/adjudicacion/${h.consolidacion.id}/imprimir-a04`} label="Ver / Imprimir SIAF-04" />}>
                        <p className="text-xs text-gray-500">Correlativo A-04 SIAF generado en Fondo Rotativo.</p>
                      </Paso>
                    )}

                    {/* Paso: Orden de compra (solo camino de Presupuesto) */}
                    {h.orden && (
                      <Paso icon={ShoppingCart} titulo={`Orden de Compra ${h.orden.numero}/${h.orden.anio}`}>
                        <p className="text-xs text-gray-500">Fecha: {h.orden.fecha} · Estado: {h.orden.estado}</p>
                      </Paso>
                    )}

                    {/* Paso: Pago (solo camino de Fondo Rotativo, una vez generado el SIAF-04) */}
                    {h.pago && (
                      <Paso icon={Wallet} titulo="Pago (Fondo Rotativo)">
                        <p className="text-xs text-gray-500">
                          {!h.pago.forma_pago && "Esperando elegir forma de pago en Fondo Rotativo/Pagos"}
                          {h.pago.forma_pago === "cheque" &&
                            `Cheque No. ${h.pago.numero_cheque ?? "—"}${h.pago.fecha_emision_cheque ? ` · Emitido el ${h.pago.fecha_emision_cheque}` : ""} → Enviado a Fondo Rotativo/Bancos`}
                          {h.pago.forma_pago === "efectivo" &&
                            `Efectivo · Vale No. ${h.pago.numero_vale ?? "—"}${h.pago.fecha_pago ? ` · Pagado el ${h.pago.fecha_pago}` : ""} → Enviado a Fondo Rotativo/Libro Caja Chica`}
                        </p>
                      </Paso>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

function PrintLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} target="_blank"
      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
      <Printer className="w-3 h-3" /> {label}
    </Link>
  );
}

function Paso({ icon: Icon, titulo, accion, children }: {
  icon: React.ComponentType<{ className?: string }>; titulo: string;
  accion?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-brand-100 text-brand-700">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">{titulo}</p>
          {accion}
        </div>
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
