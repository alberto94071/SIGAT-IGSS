"use client";
import { fechaGuatemala } from "@/lib/date-utils";

import { useState, useMemo } from "react";
import { BookOpen, Search, AlertTriangle, Clock, XCircle, Check, ShoppingCart } from "lucide-react";
import { actualizarUmbralesInsumo, type InsumoAlmacen } from "./actions";
import ReportesAlmacenPanel from "./ReportesAlmacenPanel";

// Umbral de "próximo a vencer" por defecto cuando el insumo no tiene uno
// configurado — el cliente pidió que sea configurable por insumo
// (2026-08-26), esto es solo el valor de arranque hasta que alguien lo
// ajuste desde el Catálogo.
const DIAS_ALERTA_VENCIMIENTO_DEFAULT = 90;

type Tab = "todos" | "baja" | "por_vencer" | "vencidos";
const TABS: { id: Tab; label: string }[] = [
  { id: "todos",      label: "Todos" },
  { id: "baja",       label: "Baja existencia" },
  { id: "por_vencer", label: "Próximos a vencer" },
  { id: "vencidos",   label: "Vencidos" },
];

// Insumos "S/C" comparten placeholder, no código real — se muestra el
// nombre como identificador visible en vez del código, igual criterio que
// el resto del sistema.
function etiquetaCodigo(i: InsumoAlmacen): string {
  return i.codigo_igss && i.codigo_igss !== "S/C" ? i.codigo_igss : "S/C";
}

function diasHasta(fechaIso: string): number {
  const hoy = new Date(fechaGuatemala() + "T00:00:00");
  const meta = new Date(fechaIso + "T00:00:00");
  return Math.round((meta.getTime() - hoy.getTime()) / 86400000);
}

export default function CatalogoAlmacenClient({ insumos: init, canEdit, onAgregarASolicitud }: {
  insumos: InsumoAlmacen[]; canEdit: boolean;
  // Cuando se pasa, el Catálogo entra en "modo solicitud" (usado por
  // solicitar-insumos/catalogo, colaborador): oculta la edición de umbrales
  // y los reportes (no le corresponden), y en su lugar muestra un botón
  // "Agregar a solicitud" por fila que delega en este callback — el carrito
  // en sí (server actions, modal de cantidad) vive en el componente padre
  // para no acoplar este componente compartido a solicitar-insumos/actions.ts.
  onAgregarASolicitud?: (insumo: InsumoAlmacen) => void;
}) {
  const modoSolicitud = onAgregarASolicitud != null;
  const [insumos, setInsumos] = useState(init);
  const [tab, setTab] = useState<Tab>("todos");
  const [query, setQuery] = useState("");

  const q = query.toLowerCase().trim();
  const buscados = useMemo(() => !q ? insumos : insumos.filter(i =>
    i.nombre.toLowerCase().includes(q) ||
    (i.codigo_igss ?? "").toLowerCase().includes(q) ||
    String(i.renglon ?? "").includes(q)
  ), [insumos, q]);

  const clasificados = useMemo(() => {
    const baja: InsumoAlmacen[] = [];
    const porVencer: InsumoAlmacen[] = [];
    const vencidos: InsumoAlmacen[] = [];
    for (const i of buscados) {
      if (i.stock_minimo != null && i.cantidad_disponible_total <= i.stock_minimo) baja.push(i);
      if (i.proximo_vencimiento) {
        const dias = diasHasta(i.proximo_vencimiento);
        const umbral = i.dias_alerta_vencimiento ?? DIAS_ALERTA_VENCIMIENTO_DEFAULT;
        if (dias < 0) vencidos.push(i);
        else if (dias <= umbral) porVencer.push(i);
      }
    }
    return { baja, porVencer, vencidos };
  }, [buscados]);

  const visibles = tab === "todos" ? buscados
    : tab === "baja" ? clasificados.baja
    : tab === "por_vencer" ? clasificados.porVencer
    : clasificados.vencidos;

  async function guardarUmbrales(id: number, stockMinimo: number | null, diasAlerta: number | null) {
    setInsumos(prev => prev.map(i => i.id === id ? { ...i, stock_minimo: stockMinimo, dias_alerta_vencimiento: diasAlerta } : i));
    await actualizarUmbralesInsumo(id, stockMinimo, diasAlerta);
  }

  const renglonesDisponibles = useMemo(() => [...new Set(
    insumos.map(i => i.renglon).filter((r): r is number => r != null)
  )].sort((a, b) => a - b), [insumos]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Catálogo de Almacén
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {insumos.length} insumo(s) con existencia registrada — cada ingreso viene de un DAB-60 aprobado.
          </p>
        </div>
        {!modoSolicitud && <ReportesAlmacenPanel renglonesDisponibles={renglonesDisponibles} />}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => {
          const count = t.id === "todos" ? buscados.length
            : t.id === "baja" ? clasificados.baja.length
            : t.id === "por_vencer" ? clasificados.porVencer.length
            : clasificados.vencidos.length;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t.id === "baja" && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
              {t.id === "por_vencer" && <Clock className="w-3.5 h-3.5 text-amber-500" />}
              {t.id === "vencidos" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
              {t.label} {count > 0 && <span className="text-xs text-gray-400">({count})</span>}
            </button>
          );
        })}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por nombre, código o renglón…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Insumo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Código</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Renglón</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Unidad</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Ingresado</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Disponible</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Próx. vencimiento</th>
                {modoSolicitud ? (
                  <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
                ) : (
                  <>
                    <th className="px-4 py-3 text-left whitespace-nowrap">Stock mín.</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">Días alerta</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibles.map(i => (
                <FilaInsumo key={i.id} insumo={i} canEdit={canEdit} onGuardar={guardarUmbrales} onAgregarASolicitud={onAgregarASolicitud} />
              ))}
            </tbody>
          </table>
          {visibles.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                {q ? "Sin resultados para esa búsqueda." : tab === "todos"
                  ? "Todavía no hay insumos con existencia — se registran solos al aprobar un DAB-60."
                  : "Nada en esta pestaña por ahora."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilaInsumo({ insumo: i, canEdit, onGuardar, onAgregarASolicitud }: {
  insumo: InsumoAlmacen; canEdit: boolean;
  onGuardar: (id: number, stockMinimo: number | null, diasAlerta: number | null) => void;
  onAgregarASolicitud?: (insumo: InsumoAlmacen) => void;
}) {
  const [stockMinimo, setStockMinimo] = useState(i.stock_minimo != null ? String(i.stock_minimo) : "");
  const [diasAlerta, setDiasAlerta] = useState(i.dias_alerta_vencimiento != null ? String(i.dias_alerta_vencimiento) : "");
  const [guardado, setGuardado] = useState(false);

  const bajaExistencia = i.stock_minimo != null && i.cantidad_disponible_total <= i.stock_minimo;
  const diasVencimiento = i.proximo_vencimiento ? diasHasta(i.proximo_vencimiento) : null;
  const vencido = diasVencimiento != null && diasVencimiento < 0;
  const porVencer = diasVencimiento != null && !vencido && diasVencimiento <= (i.dias_alerta_vencimiento ?? DIAS_ALERTA_VENCIMIENTO_DEFAULT);

  function guardar() {
    onGuardar(i.id, stockMinimo.trim() === "" ? null : Number(stockMinimo), diasAlerta.trim() === "" ? null : Number(diasAlerta));
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1500);
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{i.nombre}</p>
        {i.descripcion_igss && i.descripcion_igss !== i.nombre && (
          <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{i.descripcion_igss}</p>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">{etiquetaCodigo(i)}</td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{i.renglon ?? "—"}</td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{i.unidad_medida ?? "—"}</td>
      <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{i.cantidad_ingresada_total.toLocaleString("es-GT")}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <span className={`font-semibold ${bajaExistencia ? "text-amber-600" : "text-gray-900"}`}>
          {i.cantidad_disponible_total.toLocaleString("es-GT")}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {i.proximo_vencimiento ? (
          <span className={vencido ? "text-red-600 font-semibold" : porVencer ? "text-amber-600 font-semibold" : "text-gray-600"}>
            {i.proximo_vencimiento}
          </span>
        ) : <span className="text-gray-300">—</span>}
      </td>
      {onAgregarASolicitud ? (
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <button onClick={() => onAgregarASolicitud(i)} disabled={i.cantidad_disponible_total <= 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <ShoppingCart className="w-3.5 h-3.5" /> Agregar
          </button>
        </td>
      ) : (
        <>
          <td className="px-4 py-3 whitespace-nowrap">
            {canEdit ? (
              <input type="number" min={0} className="input w-20 py-1 text-xs" placeholder="—"
                value={stockMinimo} onChange={e => setStockMinimo(e.target.value)} onBlur={guardar} />
            ) : (stockMinimo || "—")}
          </td>
          <td className="px-4 py-3 whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              {canEdit ? (
                <input type="number" min={0} className="input w-20 py-1 text-xs" placeholder={String(DIAS_ALERTA_VENCIMIENTO_DEFAULT)}
                  value={diasAlerta} onChange={e => setDiasAlerta(e.target.value)} onBlur={guardar} />
              ) : (diasAlerta || DIAS_ALERTA_VENCIMIENTO_DEFAULT)}
              {guardado && <Check className="w-3.5 h-3.5 text-emerald-500" />}
            </div>
          </td>
        </>
      )}
    </tr>
  );
}
