"use client";
import { useState, useRef, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { Printer, ChevronDown, X, ArrowLeft } from "lucide-react";

type Item = {
  id: number; nombre: string; descripcion_igss: string | null; codigo_igss: string | null; codigo_ppr: string | null;
  subproducto: string; unidad_medida: string | null; cantidad_solicitada: number;
};
type Solicitud = { id: number; numero: number; anio: number; fecha: string; estado: string };
type Config = {
  nombre_unidad_ejecutora: string; centro_costo_nombre: string;
  direccion_unidad: string; justificacion_siaf: string;
};
type Firmante = { id: number; nombre: string; cargo: string };

interface Props {
  solicitud: Solicitud; items: Item[]; config: Config;
  todosFirmantes: Firmante[]; firmantesSeleccionados: Firmante[];
  mostrarSubproducto: boolean;
  impresoPor: string;
}

const FONT = "Arial, Helvetica, sans-serif";
const B = "2px solid #1a1a1a";
const R = "10px";
const C = "#000";

// Alturas fijas en px — calibradas para que el sheet tenga proporción A4 (1:1.41)
// Ancho = 210mm ≈ 794px en pantalla a 96dpi → alto objetivo ≈ 1123px
const H_BOX1 = 82;    // Logo + título
const H_BOX2 = 130;   // Datos de registro (más alto para que quepa Dirección con aire abajo)
const H_TABLE = 610;   // Tabla — el bloque más grande, da la proporción A4
const H_FIRMA = 78;    // Recuadros de firma
const H_JUST = 88;    // Justificación — más alta para que quepan justificaciones largas
const GAP = 4;     // px entre recuadros

const W_COD = 84;     // Ancho columna Código
const W_CANT = 88;     // Ancho columna Cantidad

// Algunos insumos de Base de Datos Central traen el código como un rango
// ("32327 - 35227") en vez de un número corto — sin esto se cortaba a dos
// líneas dentro de la columna. Encoge la letra según el largo para que
// siempre quepa en una sola línea, sin truncar el código.
function codigoFontSize(texto: string): string {
  const len = texto.length;
  if (len <= 6) return "8pt";
  if (len <= 9) return "7.2pt";
  if (len <= 13) return "6.4pt";
  return "5.8pt";
}

// Muchos códigos IGSS de Base de Datos Central vienen como un rango numérico
// ("128843 - 135227") que en la práctica es un solo insumo con dos números de
// referencia — el cliente solo necesita el de la izquierda impreso en el
// SIAF, y corregirlo en Base de Datos Central implicaría tocar uno por uno
// entre ~207 mil registros. No aplica a códigos de servicio tipo "SC-990510"
// (el lado izquierdo del guión ahí no es numérico), esos se imprimen
// completos como siempre. Es solo un recorte para la impresión — no modifica
// el dato guardado.
function codigoParaImprimir(texto: string): string {
  const m = texto.match(/^(\d+)\s*-\s*\d+\s*$/);
  return m ? m[1] : texto;
}

// Alturas del bloque tabla, iguales en todas las hojas (el resumen de
// subproductos no cambia el alto total, solo cuánto de su cuerpo se llena)
const HEADER_H = 26;
const NOTA_H = 22;
const SUBPROD_HEADER_H = 22;
const SUBPROD_ROW_H = 18;
const SUBPROD_MIN_ROWS = 6;
const TOTAL_H = 24;
const ROW_H = 24;

// Cada ítem ocupa 1 o más "franjas" de ROW_H — más de una cuando su
// descripción es tan larga que necesita varias líneas (ver medición en el
// componente principal). filaSlots viene de ahí, indexado igual que items.
type ItemConSlots = { item: Item; slots: number };
type PageInfo = {
  items: ItemConSlots[];
  vienen: number | null;  // cantidad que "vienen" de la hoja anterior (null si es la primera)
  van: number | null;     // cantidad que "van" a la hoja siguiente (null si es la última)
  totalCantidad: number;  // total acumulado hasta el final de esta hoja
};

// Reparte los ítems en hojas por FRANJAS ocupadas (no por cantidad de
// ítems) — un ítem con descripción larga puede ocupar 2 o más franjas de
// ROW_H. Reserva una franja para "Vienen..." al inicio de cada hoja que no
// sea la primera, y una franja para "Van..." al final de cada hoja que no
// sea la última.
function paginarItems(items: Item[], filaSlots: number[], capacidad: number): PageInfo[] {
  const conSlots: ItemConSlots[] = items.map((item, i) => ({ item, slots: filaSlots[i] ?? 1 }));
  const totalSlots = conSlots.reduce((s, x) => s + x.slots, 0);
  if (totalSlots <= capacidad) {
    const total = items.reduce((s, i) => s + i.cantidad_solicitada, 0);
    return [{ items: conSlots, vienen: null, van: null, totalCantidad: total }];
  }
  const pages: PageInfo[] = [];
  let idx = 0;
  let cumulative = 0;
  let isFirst = true;
  while (idx < conSlots.length) {
    const capSinVan = capacidad - (isFirst ? 0 : 1);
    let usedSlots = 0;
    let endIdx = idx;
    while (endIdx < conSlots.length && usedSlots + conSlots[endIdx].slots <= capSinVan) {
      usedSlots += conSlots[endIdx].slots;
      endIdx++;
    }
    // Un ítem cuya descripción es tan larga que no cabe ni solo en una hoja
    // llena igual se imprime (ocupando la hoja completa) — para no quedar en
    // un loop infinito sin avanzar.
    if (endIdx === idx) { endIdx = idx + 1; usedSlots = conSlots[idx].slots; }
    const hayMasDespues = endIdx < conSlots.length;
    if (hayMasDespues) {
      // Si falta espacio para la franja de "Van...", se devuelve el último
      // ítem agregado a la siguiente hoja (excepto si es el único de esta hoja).
      while (endIdx > idx + 1 && usedSlots + 1 > capSinVan) {
        endIdx--;
        usedSlots -= conSlots[endIdx].slots;
      }
    }
    const pageItems = conSlots.slice(idx, endIdx);
    const vienenValue = isFirst ? null : cumulative;
    cumulative += pageItems.reduce((s, x) => s + x.item.cantidad_solicitada, 0);
    idx = endIdx;
    const isLast = idx >= conSlots.length;
    pages.push({ items: pageItems, vienen: vienenValue, van: isLast ? null : cumulative, totalCantidad: cumulative });
    isFirst = false;
  }
  return pages;
}

// Contenido de una fila de ítem (Código / Descripción [+ Subproducto] /
// Cantidad) — compartido entre la pasada de medición (oculta, altura
// natural) y el render real (altura fija en franjas de ROW_H), para que lo
// que se mide sea EXACTAMENTE lo que se imprime.
function FilaItemContenido({ item, mostrarSubproducto }: { item: Item; mostrarSubproducto: boolean }) {
  return (
    <>
      <div style={{ width: W_COD, textAlign: "center", flexShrink: 0, fontFamily: "monospace", fontSize: codigoFontSize(codigoParaImprimir(String(item.codigo_igss ?? ""))), whiteSpace: "nowrap", overflow: "hidden" }}>
        {codigoParaImprimir(String(item.codigo_igss ?? ""))}
      </div>
      <div style={{ flex: 1, padding: "3px 8px", display: "flex", justifyContent: mostrarSubproducto ? "space-between" : "flex-start", alignItems: "center" }}>
        <span style={{ textTransform: "uppercase", fontSize: "8pt", lineHeight: 1.2, width: mostrarSubproducto ? undefined : "100%" }}>
          {item.descripcion_igss || item.nombre}
        </span>
        {mostrarSubproducto && (
          <span style={{ fontSize: "7.5pt", color: "#333", whiteSpace: "nowrap", marginLeft: "8px", flexShrink: 0 }}>
            {item.subproducto}
          </span>
        )}
      </div>
      <div style={{ width: W_CANT, textAlign: "center", flexShrink: 0, fontSize: "9pt" }}>
        {item.cantidad_solicitada.toLocaleString("es-GT")}
      </div>
    </>
  );
}

// Cuando la hoja no tiene ningún insumo del renglón 182 (mostrarSubproducto
// en false), la leyenda de "productos homologados... SIGES" no aplica —
// en su lugar se imprime el/los código(s) PpR de los insumos de esa hoja.
// A diferencia de la columna "Código" de la tabla, acá NO se recorta el
// rango — el cliente pidió el número completo tal como está guardado.
function textoCodigosPpr(items: Item[]): string {
  const codigos = [...new Set(items.map(i => i.codigo_ppr).filter((c): c is string => !!c))];
  return codigos.length > 0 ? `Código PpR: ${codigos.join(", ")}` : "";
}

export default function ImprimirClient({
  solicitud, items, config, todosFirmantes, firmantesSeleccionados: initFirmantes, mostrarSubproducto, impresoPor,
}: Props) {
  const router = useRouter();
  const [firmantes, setFirmantes] = useState<Firmante[]>(initFirmantes);
  const [showSelector, setShowSelector] = useState(initFirmantes.length === 0);
  const [slot, setSlot] = useState<0 | 1>(0);

  // Descripciones largas necesitan más de una franja de ROW_H para no
  // quedar recortadas a la mitad (antes la fila tenía altura fija de 24px
  // con overflow:hidden y se comía el texto que no cabía en una sola línea).
  // Antes de saber cuántas hojas/filas hacen falta, se mide en una pasada
  // oculta cuántas franjas ocupa cada ítem con su descripción real, usando
  // exactamente el mismo layout que la fila visible (ver FilaItemContenido)
  // para que lo medido sea lo que se imprime.
  const [rowSlots, setRowSlots] = useState<number[] | null>(null);
  const medirRefs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    if (rowSlots !== null) return;
    const slots = items.map((_, i) => {
      const h = medirRefs.current[i]?.getBoundingClientRect().height ?? ROW_H;
      return Math.max(1, Math.ceil(h / ROW_H));
    });
    setRowSlots(slots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function pickFirmante(idx: 0 | 1, f: Firmante) {
    setFirmantes(p => { const n = [...p]; n[idx] = f; return n; });
  }

  const corrLabel = `${solicitud.numero}/${solicitud.anio}`;

  // Resumen: suma de cantidad_solicitada agrupada por subproducto (de todo el SIAF,
  // sin importar en qué hoja caiga cada ítem) — solo se muestra en la última hoja.
  const resumenSubproductos = Object.values(
    items.reduce((acc, item) => {
      const key = item.subproducto || "—";
      if (!acc[key]) acc[key] = { subproducto: key, cantidad: 0 };
      acc[key].cantidad += item.cantidad_solicitada;
      return acc;
    }, {} as Record<string, { subproducto: string; cantidad: number }>)
  );
  const subprodRows = Math.max(SUBPROD_MIN_ROWS, resumenSubproductos.length);
  const SUBPROD_BODY_H = SUBPROD_ROW_H * subprodRows;
  const FOOTER_H = NOTA_H + SUBPROD_HEADER_H + SUBPROD_BODY_H + TOTAL_H;
  const rowsArea = H_TABLE - HEADER_H - FOOTER_H;
  const maxRows = Math.floor(rowsArea / ROW_H);

  const pages = rowSlots !== null ? paginarItems(items, rowSlots, maxRows) : [];

  return (
    <>
      {/* ── Barra de controles ── */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">A-01 SIAF — {corrLabel}</span>
        <div className="flex items-center gap-3 ml-auto">
          {[0, 1].map(idx => (
            <button key={idx}
              onClick={() => { setSlot(idx as 0 | 1); setShowSelector(true); }}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50 max-w-[220px]">
              <span className="truncate">
                {firmantes[idx]
                  ? <><strong>{firmantes[idx].nombre}</strong> — {firmantes[idx].cargo}</>
                  : <span className="text-gray-400">Firmante {idx + 1}…</span>}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
            </button>
          ))}
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      {/* Selector firmante */}
      {showSelector && (
        <div className="no-print fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="font-semibold text-sm">Selecciona firmante {slot + 1}</p>
              <button onClick={() => setShowSelector(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="py-2 max-h-64 overflow-y-auto">
              {todosFirmantes.map(f => (
                <button key={f.id} onMouseDown={() => { pickFirmante(slot, f); setShowSelector(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-brand-50">
                  <p className="text-sm font-medium">{f.nombre}</p>
                  <p className="text-xs text-gray-500">{f.cargo}</p>
                </button>
              ))}
              {todosFirmantes.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">No hay firmantes configurados.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pasada de medición oculta: mismo layout que la fila real (mismo ancho
          de columna, mismo tamaño de letra), pero con altura natural en vez
          de fija — para saber cuántas franjas de ROW_H necesita cada ítem
          antes de repartirlos en hojas. No se pinta (visibility:hidden +
          height:0 en el contenedor), pero SÍ participa del layout, así que
          getBoundingClientRect() en cada fila da su alto real. */}
      {rowSlots === null && (
        <div aria-hidden style={{ position: "absolute", top: 0, left: 0, visibility: "hidden", height: 0, overflow: "hidden" }}>
          <div className="a4-sheet" style={{ boxShadow: "none", margin: 0 }}>
            <div style={{ border: B, display: "flex", flexDirection: "column" }}>
              {items.map((item, i) => (
                <div key={item.id} ref={el => { medirRefs.current[i] = el; }} style={{ display: "flex", alignItems: "center", fontFamily: FONT, color: C }}>
                  <FilaItemContenido item={item} mostrarSubproducto={mostrarSubproducto} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ HOJAS A4 (una por página) ══════════════ */}
      <div id="print-wrapper">
        {pages.map((page, i) => {
          const pageNum = i + 1;
          const totalPages = pages.length;
          const esUltima = pageNum === totalPages;
          const usedRows = page.items.reduce((s, x) => s + x.slots, 0) + (page.vienen !== null ? 1 : 0) + (page.van !== null ? 1 : 0);
          const emptyRows = Math.max(0, maxRows - usedRows);
          const subprodEmptyRows = esUltima ? subprodRows - resumenSubproductos.length : subprodRows;

          return (
            // El wrapper exterior NO es flex a propósito: los saltos de página forzados
            // (break-before/page-break-before) no son fiables en Chromium cuando se
            // aplican directamente sobre un elemento display:flex como .a4-sheet.
            <div key={pageNum} className={`sheet-page${i > 0 ? " sheet-page-break" : ""}`}>
            <div className="a4-sheet">

              {/* ── RECUADRO 1: Logo + Título (sin línea divisora) ── */}
              <div style={{
                border: B, borderRadius: R, display: "flex", alignItems: "center",
                height: H_BOX1, marginBottom: GAP, overflow: "hidden",
              }}>
                <div style={{ width: "220px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 8px", height: "100%" }}>
                  <img src="/LOGO_SIAF01.svg" alt="IGSS"
                    style={{ height: `${H_BOX1 - 10}px`, width: "auto", maxWidth: "200px", objectFit: "contain", display: "block" }} />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", paddingRight: "20px" }}>
                  <p style={{ margin: "0 0 4px 0", fontWeight: "bold", fontSize: "15pt", fontFamily: FONT, color: C }}>
                    FORMA A-01 SIAF
                  </p>
                  <p style={{ margin: 0, fontWeight: "bold", fontSize: "13pt", fontFamily: FONT, color: C }}>
                    SOLICITUD DE COMPRA DE BIENES Y/O SERVICIOS
                  </p>
                </div>
              </div>

              {/* ── RECUADRO 2: Datos de registro ── */}
              <div style={{
                border: B, borderRadius: R, height: H_BOX2, marginBottom: GAP,
                padding: "8px 14px 22px 14px", boxSizing: "border-box",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "7px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontWeight: "bold", fontFamily: FONT, fontSize: "11pt", color: C }}>Fecha de Registro</span>
                    <span style={{ fontFamily: FONT, fontSize: "11pt", color: C }}>{solicitud.fecha}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontWeight: "bold", fontFamily: FONT, fontSize: "11pt", color: C }}>Correlativo No.</span>
                    <span style={{ fontWeight: "bold", fontFamily: FONT, fontSize: "11pt", color: C }}>{corrLabel}</span>
                  </div>
                </div>

                <p style={{ fontWeight: "bold", fontSize: "8pt", margin: "0 0 6px 0", fontFamily: FONT, color: C }}>
                  DATOS DE LA UNIDAD EJECUTORA, CENTRO COSTO, DEPENDENCIA o SERVICIO
                </p>

                <div style={{ display: "flex", marginBottom: "6px", alignItems: "flex-start" }}>
                  <span style={{ fontWeight: "bold", fontFamily: FONT, fontSize: "8.5pt", color: C, minWidth: "110px", flexShrink: 0 }}>
                    Nombre:
                  </span>
                  <div style={{ fontFamily: FONT, fontSize: "8.5pt", color: C, lineHeight: 1.4 }}>
                    <div>{config.nombre_unidad_ejecutora}</div>
                    <div style={{ marginTop: "2px" }}>{config.centro_costo_nombre}</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start" }}>
                  <span style={{ fontWeight: "bold", fontFamily: FONT, fontSize: "8.5pt", color: C, minWidth: "110px", flexShrink: 0 }}>
                    Dirección:
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: "8.5pt", color: C }}>{config.direccion_unidad}</span>
                </div>
              </div>

              {/* ── RECUADRO 3: Tabla — esquinas inferiores rectas en el original ── */}
              <div style={{
                border: B,
                borderRadius: `${R} ${R} 0 0`,
                height: H_TABLE, marginBottom: GAP,
                overflow: "hidden",
                display: "flex", flexDirection: "column",
              }}>
                <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: W_COD, top: 0, bottom: 0, width: "2px", background: "#1a1a1a", zIndex: 1 }} />
                  <div style={{ position: "absolute", right: W_CANT, top: 0, bottom: 0, width: "2px", background: "#1a1a1a", zIndex: 1 }} />

                  <div style={{
                    display: "flex", borderBottom: B, height: HEADER_H,
                    flexShrink: 0,
                    fontWeight: "bold", fontSize: "9pt", fontFamily: FONT, color: C,
                  }}>
                    <div style={{ width: W_COD, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>Código</div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>Descripción</div>
                    <div style={{ width: W_CANT, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>Cantidad</div>
                  </div>

                  <div style={{ flex: 1, overflow: "hidden" }}>
                    {page.vienen !== null && (
                      <div style={{ display: "flex", height: ROW_H, alignItems: "center", fontFamily: FONT, color: C }}>
                        <div style={{ width: W_COD, flexShrink: 0 }} />
                        <div style={{ flex: 1, padding: "0 8px", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                          <span style={{ fontSize: "8.5pt", fontWeight: "bold", fontStyle: "italic" }}>Vienen...</span>
                        </div>
                        <div style={{ width: W_CANT, textAlign: "center", flexShrink: 0, fontSize: "9pt", fontWeight: "bold" }}>
                          {page.vienen.toLocaleString("es-GT")}
                        </div>
                      </div>
                    )}

                    {page.items.map(({ item, slots }) => (
                      <div key={item.id} style={{ display: "flex", height: ROW_H * slots, alignItems: "center", fontFamily: FONT, color: C }}>
                        <FilaItemContenido item={item} mostrarSubproducto={mostrarSubproducto} />
                      </div>
                    ))}

                    {page.van !== null && (
                      <div style={{ display: "flex", height: ROW_H, alignItems: "center", fontFamily: FONT, color: C }}>
                        <div style={{ width: W_COD, flexShrink: 0 }} />
                        <div style={{ flex: 1, padding: "0 8px", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                          <span style={{ fontSize: "8.5pt", fontWeight: "bold", fontStyle: "italic" }}>Van...</span>
                        </div>
                        <div style={{ width: W_CANT, textAlign: "center", flexShrink: 0, fontSize: "9pt", fontWeight: "bold" }}>
                          {page.van.toLocaleString("es-GT")}
                        </div>
                      </div>
                    )}

                    {Array.from({ length: emptyRows }).map((_, ei) => (
                      <div key={`e${ei}`} style={{ height: ROW_H }} />
                    ))}
                  </div>
                </div>

                {/* Nota — solo ocupa el ancho de la columna Descripción, no toda la tabla.
                    Las líneas verticales que separan Código/Descripción/Cantidad se
                    repiten acá (mismo left/right que arriba) para que no se corten
                    justo donde empieza esta fila. Sin borde superior — la fila de
                    arriba (filas vacías) ya cierra visualmente ahí. */}
                <div style={{ height: NOTA_H, display: "flex", alignItems: "center", flexShrink: 0, position: "relative" }}>
                  <div style={{ position: "absolute", left: W_COD, top: 0, bottom: 0, width: "2px", background: "#1a1a1a", zIndex: 1 }} />
                  <div style={{ position: "absolute", right: W_CANT, top: 0, bottom: 0, width: "2px", background: "#1a1a1a", zIndex: 1 }} />
                  <div style={{ width: W_COD, flexShrink: 0 }} />
                  <span style={{ flex: 1, padding: "0 8px", fontSize: "6.5pt", color: "#555", fontFamily: FONT }}>
                    {mostrarSubproducto
                      ? "Los productos de los listados institucionales, se encuentran homologados con el catálogo general de insumos del SIGES, Presupuesto por Resultados (PpR)"
                      : textoCodigosPpr(page.items.map(x => x.item))}
                  </span>
                  <div style={{ width: W_CANT, flexShrink: 0 }} />
                </div>

                {/* Footer: Código de Subproducto + Total con línea vertical continua */}
                <div style={{ borderTop: B, flexShrink: 0, position: "relative" }}>
                  <div style={{ position: "absolute", left: "50%", marginLeft: "-1px", top: 0, bottom: 0, width: "2px", background: "#1a1a1a", zIndex: 1 }} />

                  <div style={{ display: "flex", height: SUBPROD_HEADER_H, alignItems: "center", fontWeight: "bold", fontSize: "8.5pt", fontFamily: FONT, color: C }}>
                    <div style={{ flex: 1, textAlign: "center" }}>Código de Subproducto</div>
                    <div style={{ flex: 1, textAlign: "center" }}>Cantidad por Subproducto</div>
                  </div>

                  <div style={{ borderTop: B }} />

                  <div style={{ height: SUBPROD_BODY_H }}>
                    {esUltima && resumenSubproductos.map((r, ri) => (
                      <div key={r.subproducto} style={{
                        display: "flex", height: SUBPROD_ROW_H, alignItems: "center",
                        fontSize: "8pt", fontFamily: FONT, color: C,
                        borderTop: ri === 0 ? "none" : "1px solid transparent",
                      }}>
                        <div style={{ flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 6px" }}>
                          {r.subproducto}
                        </div>
                        <div style={{ flex: 1, textAlign: "center" }}>
                          {r.cantidad.toLocaleString("es-GT")}
                        </div>
                      </div>
                    ))}
                    {Array.from({ length: subprodEmptyRows }).map((_, si) => (
                      <div key={`se${si}`} style={{
                        display: "flex", height: SUBPROD_ROW_H,
                        borderTop: (esUltima ? resumenSubproductos.length + si : si) === 0 ? "none" : "1px solid transparent",
                      }} />
                    ))}
                  </div>

                  <div style={{ borderTop: B }} />

                  <div style={{ display: "flex", height: TOTAL_H, alignItems: "center", fontFamily: FONT, color: C }}>
                    <div style={{ flex: 1, textAlign: "right", paddingRight: "14px", fontWeight: "bold", fontSize: "9pt" }}>Total</div>
                    <div style={{ flex: 1, textAlign: "center", fontWeight: "bold", fontSize: "10pt" }}>
                      {page.totalCantidad.toLocaleString("es-GT")}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Firmas ── */}
              <div style={{ display: "flex", gap: "12px", height: H_FIRMA, marginBottom: GAP }}>
                {[0, 1].map(idx => (
                  <div key={idx} style={{ flex: 1, border: B, borderRadius: R, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 14px 10px" }}>
                    <div style={{ width: "100%", textAlign: "center" }}>
                      <p style={{ margin: "0 0 2px 0", fontWeight: "bold", fontSize: "8.5pt", textTransform: "uppercase", fontFamily: FONT, color: C }}>
                        {firmantes[idx]?.nombre ?? ""}
                      </p>
                      <p style={{ margin: 0, fontSize: "8pt", fontFamily: FONT, color: C }}>
                        {firmantes[idx]?.cargo ?? ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Justificación ── */}
              <div style={{
                border: B, borderRadius: R, height: H_JUST, marginBottom: GAP,
                padding: "4px 12px", boxSizing: "border-box",
                display: "flex", alignItems: "flex-start", gap: "6px", overflow: "hidden",
              }}>
                <span style={{ fontWeight: "bold", fontSize: "8pt", whiteSpace: "nowrap", fontFamily: FONT, color: C, paddingTop: "1px" }}>
                  JUSTIFICACIÓN:
                </span>
                <span style={{ fontSize: "8pt", textTransform: "uppercase", fontFamily: FONT, color: C, lineHeight: 1.4 }}>
                  {config.justificacion_siaf}
                </span>
              </div>

              {/* Pie */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "7.5pt", color: "#666", fontFamily: FONT }}>
                <span>ID: {solicitud.id}</span>
                <span>Impreso por: {impresoPor}</span>
                <span>Fecha de impresión: {new Date().toLocaleDateString("es-GT")}</span>
                <span>Hoja {pageNum} de {totalPages}</span>
              </div>

            </div>
            </div>
          );
        })}
      </div>

      <style>{`
        #print-wrapper {
          background: #94a3b8;
          padding: 40px 20px;
          min-height: 100vh;
          margin-top: 52px;
          box-sizing: border-box;
        }
        .sheet-page {
          display: block;
        }
        .a4-sheet {
          background: white;
          width: 210mm;
          margin: 0 auto 24px auto;
          box-shadow: 0 4px 32px rgba(0,0,0,0.22);
          padding: 12mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 0;
        }
        .no-print { display: block; }

        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .no-print { display: none !important; }
          #print-wrapper {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            min-height: 0 !important;
          }
          .a4-sheet {
            width: 100% !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .sheet-page-break {
            break-before: page;
            page-break-before: always;
          }
        }
      `}</style>
    </>
  );
}
