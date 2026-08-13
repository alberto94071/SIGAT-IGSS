"use client";
import { useState, useRef, useLayoutEffect, useCallback, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft, Eye, EyeOff, Save, RotateCcw } from "lucide-react";
import { guardarPosicionesDab60, getFondoDab60 } from "@/lib/adjudicacion/dab60-actions";

type Orden = {
  id: number; numero: number; anio: number; fecha: string; tipo_compra: string;
  proveedor_nit: string | null; proveedor_nombre: string | null; total: number | null;
  no_compromiso: string | null;
  no_recibo_almacen: string | null; serie_recibo_almacen: string | null; encargado_almacen: string | null;
  fecha_ingreso_producto: string | null; no_factura: string | null; serie_factura: string | null;
  fecha_emision: string | null; lote: string | null; fecha_vencimiento: string | null;
  marca: string | null; modelo: string | null; serie: string | null;
};
type Renglon = {
  renglon: number | null; nombre: string; cantidad: number; total: number;
  unidad_medida: string | null; codigo: string | null; codigo_igss: string | null; codigo_ppr: string | null;
};
type Datos = {
  lugarFecha: string; dependencia: string; claveAdministrativa: string;
  ordenCompra: string; a01Siaf: string; metodoCompra: string; renglon: string; descripcion: string;
};

interface Props {
  orden: Orden; renglones: Renglon[]; datos: Datos;
  posicionesGuardadas: Record<string, Pos>;
  // Por defecto el encabezado en pantalla muestra "OC-XXX/AAAA" (Orden de
  // Compra) — Fondo Rotativo no tiene número de orden, así que su página de
  // impresión pasa este override (ej. "A-04 4/2026") en su lugar. Solo
  // afecta el título mostrado en pantalla, no el papel impreso.
  tituloOverride?: string;
}

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const FONT = "Arial, Helvetica, sans-serif";

const HOJA_W_MM = 215.9;
const HOJA_H_MM = 279.4;
const ROW_H_MM = 5.5;
const MIN_W_MM = 8;
const MIN_H_MM = 4;
const DEFAULT_FONT_PT = 9;
const MIN_FONT_PT = 4;

type Pos = { top: number; left: number; width?: number; height?: number };

// Posiciones por defecto (mm desde la esquina superior izquierda de la hoja
// carta) — punto de partida calibrado contra un DAB-60 real. Se guarda lo que
// el usuario arrastre/redimensione en el modo "Ver posiciones"; lo que no se
// haya guardado todavía usa estos valores.
const POS_DEFAULT: Record<string, Pos> = {
  lugar_fecha:           { top: 25,  left: 45 },
  no_recibo_almacen:     { top: 28,  left: 150 },
  serie_recibo_almacen:  { top: 33,  left: 150 },
  no_factura:            { top: 38,  left: 150 },
  dependencia:           { top: 46,  left: 45 },
  clave_administrativa:  { top: 46,  left: 178 },
  orden_compra:          { top: 58,  left: 45 },
  a01_siaf:              { top: 58,  left: 95 },
  no_compromiso:         { top: 58,  left: 140 },
  proveedor_nombre:      { top: 56,  left: 178 },
  metodo_compra:         { top: 60,  left: 45 },
  renglon:               { top: 66,  left: 45 },
  col_cantidad:          { top: 90,  left: 48 },
  col_unidad:            { top: 90,  left: 80 },
  col_codigo:            { top: 90,  left: 148 },
  col_codigo_ppr:        { top: 96,  left: 148 },
  col_v_unitario:        { top: 90,  left: 178 },
  col_valor_total:       { top: 90,  left: 200 },
  marca:                 { top: 96,  left: 48 },
  lote:                  { top: 108, left: 150 },
  fecha_vencimiento:     { top: 114, left: 150 },
  descripcion:           { top: 128, left: 20, width: 150, height: 18 },
  encargado_almacen:     { top: 141, left: 45 },
  fecha_emision:         { top: 250, left: 20 },
  fecha_ingreso:         { top: 250, left: 75 },
  modelo:                { top: 250, left: 130 },
  serie:                 { top: 256, left: 20 },
  serie_factura:         { top: 256, left: 75 },
  proveedor_nit:         { top: 256, left: 130 },
};

// Nombre legible de cada campo — se muestra como etiqueta al pasar el mouse
// encima en el modo "Ver posiciones", para no confundir campos con formato
// parecido (fechas, números, etc.) mientras se posicionan sobre el talonario.
const FIELD_LABELS: Record<string, string> = {
  lugar_fecha:          "Lugar y fecha",
  no_recibo_almacen:    "No. de Recibo de Almacén",
  serie_recibo_almacen: "Serie de Recibo de Almacén",
  no_factura:           "No. de Factura",
  dependencia:          "Dependencia",
  clave_administrativa: "Clave administrativa",
  orden_compra:         "No. de Orden de Compra",
  a01_siaf:             "Correlativo A-01 SIAF",
  no_compromiso:        "No. de Compromiso (SIAF)",
  proveedor_nombre:     "Nombre del proveedor",
  metodo_compra:        "Método de compra",
  renglon:              "Renglón presupuestario",
  col_cantidad:         "Columna: Cantidad",
  col_unidad:           "Columna: Unidad de medida",
  col_codigo:           "Columna: Código",
  col_codigo_ppr:       "Columna: Código IGSS-PPR",
  col_v_unitario:       "Columna: Valor unitario",
  col_valor_total:      "Columna: Valor total",
  marca:                "Marca",
  lote:                 "Lote",
  fecha_vencimiento:    "Fecha de vencimiento",
  descripcion:          "Descripción",
  encargado_almacen:    "Encargado de Almacén",
  fecha_emision:        "Fecha de emisión (factura)",
  fecha_ingreso:        "Fecha de ingreso del producto",
  modelo:               "Modelo",
  serie:                "Serie",
  serie_factura:        "Serie de Factura",
  proveedor_nit:        "NIT del proveedor",
};

function useDrag(
  hojaRef: RefObject<HTMLDivElement | null>, id: string, pos: Pos,
  onChange: (id: string, pos: Pos) => void, enabled: boolean,
) {
  const draggingRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number; mmPerPxX: number; mmPerPxY: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    e.preventDefault(); e.stopPropagation();
    const rect = hojaRef.current?.getBoundingClientRect();
    if (!rect) return;
    draggingRef.current = {
      startX: e.clientX, startY: e.clientY, startTop: pos.top, startLeft: pos.left,
      mmPerPxX: HOJA_W_MM / rect.width, mmPerPxY: HOJA_H_MM / rect.height,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [enabled, hojaRef, pos.top, pos.left]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = draggingRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) * d.mmPerPxX;
    const dy = (e.clientY - d.startY) * d.mmPerPxY;
    onChange(id, { ...pos, top: Math.max(0, d.startTop + dy), left: Math.max(0, d.startLeft + dx) });
  }, [id, onChange, pos]);

  const onPointerUp = useCallback(() => { draggingRef.current = null; }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}

// Redimensiona el contenedor del campo (mm) arrastrando desde su esquina
// inferior derecha. La primera vez que se usa, arranca del tamaño natural
// que el campo ya tenía renderizado (para que no "salte").
function useResize(
  hojaRef: RefObject<HTMLDivElement | null>, fieldRef: RefObject<HTMLDivElement | null>,
  id: string, pos: Pos, onChange: (id: string, pos: Pos) => void, enabled: boolean,
) {
  const resizingRef = useRef<{ startX: number; startY: number; startW: number; startH: number; mmPerPxX: number; mmPerPxY: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    e.preventDefault(); e.stopPropagation();
    const hojaRect = hojaRef.current?.getBoundingClientRect();
    const fieldRect = fieldRef.current?.getBoundingClientRect();
    if (!hojaRect || !fieldRect) return;
    const mmPerPxX = HOJA_W_MM / hojaRect.width;
    const mmPerPxY = HOJA_H_MM / hojaRect.height;
    resizingRef.current = {
      startX: e.clientX, startY: e.clientY,
      startW: pos.width ?? fieldRect.width * mmPerPxX,
      startH: pos.height ?? fieldRect.height * mmPerPxY,
      mmPerPxX, mmPerPxY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [enabled, hojaRef, fieldRef, pos.width, pos.height]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const r = resizingRef.current;
    if (!r) return;
    const dx = (e.clientX - r.startX) * r.mmPerPxX;
    const dy = (e.clientY - r.startY) * r.mmPerPxY;
    onChange(id, { ...pos, width: Math.max(MIN_W_MM, r.startW + dx), height: Math.max(MIN_H_MM, r.startH + dy) });
  }, [id, onChange, pos]);

  const onPointerUp = useCallback(() => { resizingRef.current = null; }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}

// Reduce el tamaño de letra hasta que el texto quepa dentro del contenedor
// (solo cuando el campo tiene ancho/alto fijos, es decir, ya fue
// redimensionado); si no, el campo sigue usando su ancho natural de siempre.
function useAutoFit(ref: RefObject<HTMLElement | null>, active: boolean, ...deps: unknown[]) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!active) { el.style.fontSize = ""; return; }
    let size = DEFAULT_FONT_PT;
    el.style.fontSize = `${size}pt`;
    while (size > MIN_FONT_PT && (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)) {
      size -= 0.25;
      el.style.fontSize = `${size}pt`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);
}

type Handlers = { onPointerDown: (e: React.PointerEvent) => void; onPointerMove: (e: React.PointerEvent) => void; onPointerUp: () => void };

function DragHandle({ handlers, label }: { handlers: Handlers; label?: string }) {
  return (
    <div
      className="dab-handle dab-handle-move no-print" contentEditable={false}
      title={label ? `Mover — ${label}` : "Mover"}
      onPointerDown={handlers.onPointerDown} onPointerMove={handlers.onPointerMove} onPointerUp={handlers.onPointerUp}
    />
  );
}

function ResizeHandle({ handlers, label }: { handlers: Handlers; label?: string }) {
  return (
    <div
      className="dab-handle dab-handle-resize no-print" contentEditable={false}
      title={label ? `Cambiar tamaño — ${label}` : "Cambiar tamaño"}
      onPointerDown={handlers.onPointerDown} onPointerMove={handlers.onPointerMove} onPointerUp={handlers.onPointerUp}
    />
  );
}

function Campo({
  id, texto, hojaRef, pos, onChange, editable, style, label, onTextChange, multiline = false,
}: {
  id: string; texto: string; hojaRef: RefObject<HTMLDivElement | null>; pos: Pos;
  onChange: (id: string, pos: Pos) => void; editable: boolean; style?: React.CSSProperties;
  label?: string; onTextChange?: (id: string, texto: string) => void; multiline?: boolean;
}) {
  // El wrapper externo (outerRef) define la posición y el tamaño del campo y
  // aloja las manijas de mover/redimensionar SIN recortarlas; el recorte
  // (overflow hidden) y el autoajuste de letra van en el div interno, para
  // que las manijas —que sobresalen un poco del borde— sigan siendo
  // clickeables aunque el campo ya tenga un tamaño fijo.
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const drag = useDrag(hojaRef, id, pos, onChange, editable);
  const resize = useResize(hojaRef, outerRef, id, pos, onChange, editable);
  const sized = pos.width != null && pos.height != null;
  useAutoFit(innerRef, sized, texto, pos.width, pos.height);

  const contenido = editable && !texto ? `⟨${id}⟩` : texto;

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    onTextChange?.(id, e.currentTarget.textContent ?? "");
  }, [id, onTextChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!multiline && e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
  }, [multiline]);

  return (
    <div
      ref={outerRef}
      className="dab-campo"
      title={editable ? label : undefined}
      style={{
        position: "absolute", top: `${pos.top}mm`, left: `${pos.left}mm`,
        width: sized ? `${pos.width}mm` : undefined, height: sized ? `${pos.height}mm` : undefined,
      }}
    >
      <div
        ref={innerRef}
        contentEditable={editable}
        suppressContentEditableWarning
        onBlur={editable ? handleBlur : undefined}
        onKeyDown={editable ? handleKeyDown : undefined}
        style={{
          width: sized ? "100%" : undefined, height: sized ? "100%" : undefined,
          overflow: sized ? "hidden" : undefined,
          fontSize: "9pt", whiteSpace: sized ? (multiline ? "pre-line" : "normal") : "nowrap",
          fontFamily: FONT, color: "#000",
          cursor: editable ? "text" : undefined,
          ...style,
        }}
      >
        {contenido}
      </div>
      {editable && <DragHandle handlers={drag} label={label} />}
      {editable && <ResizeHandle handlers={resize} label={label} />}
    </div>
  );
}

function ColumnaLinea({
  texto, align, heightMm, widthMm, sized, editable, onCommit,
}: {
  texto: string; align: "left" | "right" | "center"; heightMm: number; widthMm?: number;
  sized: boolean; editable: boolean; onCommit?: (texto: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useAutoFit(ref, sized, texto, widthMm, heightMm);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    onCommit?.(e.currentTarget.textContent ?? "");
  }, [onCommit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
  }, []);

  return (
    <div
      ref={ref} contentEditable={editable} suppressContentEditableWarning
      onBlur={editable ? handleBlur : undefined} onKeyDown={editable ? handleKeyDown : undefined}
      style={{
        height: `${heightMm}mm`, width: sized ? `${widthMm}mm` : undefined,
        overflow: sized ? "hidden" : undefined,
        fontSize: "9pt", whiteSpace: sized ? "normal" : "nowrap", fontFamily: FONT, color: "#000",
        textAlign: align, cursor: editable ? "text" : undefined,
      }}
    >
      {texto}
    </div>
  );
}

function ColumnaCampo({
  id, valores, hojaRef, pos, onChange, editable, align = "left", label, onTextChange,
}: {
  id: string; valores: string[]; hojaRef: RefObject<HTMLDivElement | null>; pos: Pos;
  onChange: (id: string, pos: Pos) => void; editable: boolean; align?: "left" | "right" | "center";
  label?: string; onTextChange?: (idx: number, texto: string) => void;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const drag = useDrag(hojaRef, id, pos, onChange, editable);
  const resize = useResize(hojaRef, fieldRef, id, pos, onChange, editable);
  const lineas = valores.length > 0 ? valores : (editable ? [`⟨${id}⟩`] : [""]);
  const sized = pos.width != null && pos.height != null;
  const rowH = sized ? (pos.height as number) / lineas.length : ROW_H_MM;

  return (
    <div
      ref={fieldRef}
      className="dab-campo"
      title={editable ? label : undefined}
      style={{
        position: "absolute", top: `${pos.top}mm`, left: `${pos.left}mm`,
        width: sized ? `${pos.width}mm` : undefined,
      }}
    >
      {lineas.map((v, i) => (
        <ColumnaLinea
          key={i} texto={v} align={align} heightMm={rowH} widthMm={sized ? pos.width : undefined}
          sized={sized} editable={editable}
          onCommit={editable ? (t) => onTextChange?.(i, t) : undefined}
        />
      ))}
      {editable && <DragHandle handlers={drag} label={label} />}
      {editable && <ResizeHandle handlers={resize} label={label} />}
    </div>
  );
}

export default function ImprimirDab60Client({ orden: o, renglones, datos, posicionesGuardadas, tituloOverride }: Props) {
  const router = useRouter();
  const [verPosiciones, setVerPosiciones] = useState(false);
  const [pos, setPos] = useState<Record<string, Pos>>({ ...POS_DEFAULT, ...posicionesGuardadas });
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [colOverrides, setColOverrides] = useState<Record<string, string[]>>({});
  const [fondo, setFondo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const hojaRef = useRef<HTMLDivElement>(null);

  // El fondo se ve siempre en pantalla (para previsualizar cómo va a quedar
  // el recibo real) — solo se oculta al imprimir (.no-print), nunca sale en
  // el papel.
  useLayoutEffect(() => {
    if (!fondo) getFondoDab60().then(setFondo);
  }, [fondo]);

  const onChangePos = useCallback((id: string, next: Pos) => {
    setPos(p => ({ ...p, [id]: next }));
  }, []);

  const onTextChange = useCallback((id: string, texto: string) => {
    setOverrides(o => ({ ...o, [id]: texto }));
  }, []);

  const onColTextChange = useCallback((id: string, idx: number, texto: string) => {
    setColOverrides(o => {
      const arr = [...(o[id] ?? [])];
      arr[idx] = texto;
      return { ...o, [id]: arr };
    });
  }, []);

  async function guardarPosiciones() {
    setGuardando(true);
    await guardarPosicionesDab60(pos);
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  }

  function restablecerPosiciones() {
    setPos({ ...POS_DEFAULT });
  }

  const numeroOrden = tituloOverride ?? `OC-${String(o.numero).padStart(3, "0")}/${o.anio}`;

  const cantidades       = renglones.map(r => r.cantidad.toLocaleString("es-GT"));
  const unidades         = renglones.map(r => r.unidad_medida ?? "");
  const codigos          = renglones.map(r => r.codigo ?? "");
  const codigosPpr       = renglones.map(r => r.codigo_igss && r.codigo_ppr ? `${r.codigo_igss}-${r.codigo_ppr}` : "");
  const vUnitarios       = renglones.map(r => r.cantidad > 0
    ? (r.total / r.cantidad).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 8 })
    : "");
  const valoresTotales   = renglones.map(r => Q(r.total));

  const campo = (id: string, textoDefault: string, opts?: { style?: React.CSSProperties; multiline?: boolean }) => {
    const texto = overrides[id] ?? textoDefault;
    return (
      <Campo
        id={id} texto={texto} hojaRef={hojaRef} pos={pos[id] ?? POS_DEFAULT[id]} onChange={onChangePos}
        editable={verPosiciones} style={opts?.style} label={FIELD_LABELS[id] ?? id}
        onTextChange={onTextChange} multiline={opts?.multiline}
      />
    );
  };
  const columna = (id: string, valoresDefault: string[], align?: "left" | "right" | "center") => {
    const overrideArr = colOverrides[id];
    const valores = overrideArr ? valoresDefault.map((v, i) => overrideArr[i] ?? v) : valoresDefault;
    return (
      <ColumnaCampo
        id={id} valores={valores} hojaRef={hojaRef} pos={pos[id] ?? POS_DEFAULT[id]} onChange={onChangePos}
        editable={verPosiciones} align={align} label={FIELD_LABELS[id] ?? id}
        onTextChange={(idx, t) => onColTextChange(id, idx, t)}
      />
    );
  };

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">DAB-60 — {numeroOrden}</span>
        {verPosiciones && (
          <span className="text-xs text-gray-400">
            Arrastrá el punto azul para mover, el verde para cambiar tamaño, y hacé clic sobre el texto para editarlo.
          </span>
        )}
        <div className="flex items-center gap-3 ml-auto">
          {verPosiciones && (
            <>
              <button onClick={restablecerPosiciones}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50">
                <RotateCcw className="w-3.5 h-3.5" /> Restablecer
              </button>
              <button onClick={guardarPosiciones} disabled={guardando}
                className="flex items-center gap-2 px-3 py-1.5 border border-brand-200 bg-brand-50 text-brand-700 rounded-lg text-xs hover:bg-brand-100 disabled:opacity-60">
                <Save className="w-3.5 h-3.5" /> {guardando ? "Guardando…" : guardado ? "Guardado ✓" : "Guardar posiciones"}
              </button>
            </>
          )}
          <button onClick={() => setVerPosiciones(p => !p)}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50">
            {verPosiciones ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {verPosiciones ? "Ocultar posiciones" : "Ver posiciones"}
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      <div id="print-wrapper">
        <div id="hoja" ref={hojaRef} style={{ fontFamily: FONT, color: "#000" }}>
          {fondo && (
            <img src={fondo} alt="" className="no-print" style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "fill", opacity: 0.55, pointerEvents: "none",
            }} />
          )}

          {campo("lugar_fecha", datos.lugarFecha)}
          {campo("no_recibo_almacen", o.no_recibo_almacen ?? "")}
          {campo("serie_recibo_almacen", o.serie_recibo_almacen ?? "")}
          {campo("no_factura", o.no_factura ?? "")}
          {campo("dependencia", datos.dependencia)}
          {campo("clave_administrativa", datos.claveAdministrativa)}
          {campo("orden_compra", datos.ordenCompra)}
          {campo("a01_siaf", datos.a01Siaf)}
          {campo("no_compromiso", o.no_compromiso ?? "")}
          {campo("proveedor_nombre", o.proveedor_nombre ?? "")}
          {campo("metodo_compra", datos.metodoCompra)}
          {campo("renglon", datos.renglon)}

          {columna("col_cantidad", cantidades, "center")}
          {columna("col_unidad", unidades, "left")}
          {columna("col_codigo", codigos, "center")}
          {columna("col_codigo_ppr", codigosPpr, "center")}
          {columna("col_v_unitario", vUnitarios, "right")}
          {columna("col_valor_total", valoresTotales, "right")}

          {campo("marca", o.marca ?? "")}
          {campo("lote", o.lote ?? "")}
          {campo("fecha_vencimiento", o.fecha_vencimiento ?? "")}
          {campo("descripcion", datos.descripcion, { style: { lineHeight: 1.35 }, multiline: true })}
          {campo("encargado_almacen", o.encargado_almacen ?? "")}

          {campo("fecha_emision", o.fecha_emision ?? "")}
          {campo("fecha_ingreso", o.fecha_ingreso_producto ?? "")}
          {campo("modelo", o.modelo ?? "")}
          {campo("serie", o.serie ?? "")}
          {campo("serie_factura", o.serie_factura ?? "")}
          {campo("proveedor_nit", o.proveedor_nit ?? "")}
        </div>
      </div>

      <style>{`
        #print-wrapper {
          background: #94a3b8; display: flex; justify-content: center; align-items: flex-start;
          padding: 40px 20px; min-height: 100vh; margin-top: 52px; box-sizing: border-box;
        }
        #hoja {
          position: relative; background: white; width: 215.9mm; height: 279.4mm;
          box-shadow: 0 4px 32px rgba(0,0,0,0.22); box-sizing: border-box; overflow: hidden;
        }
        .no-print { display: block; }
        @media print {
          @page { size: letter portrait; margin: 0; }
          .no-print { display: none !important; }
          #print-wrapper { background: white !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; display: block !important; }
          #hoja { width: 100% !important; height: 100vh !important; box-shadow: none !important; }
        }
      `}</style>
      {verPosiciones && (
        <style>{`
          @media screen {
            .dab-campo { outline: 1px dashed #f43f5e; background: rgba(244,63,94,0.06); padding: 1px 2px; box-sizing: border-box; }
          }
          .dab-handle { position: absolute; width: 3mm; height: 3mm; border-radius: 2px; box-sizing: border-box; z-index: 10; }
          .dab-handle-move { top: 0; left: -4mm; background: #3b82f6; cursor: grab; touch-action: none; }
          .dab-handle-resize { bottom: -1.5mm; right: -1.5mm; background: #10b981; cursor: nwse-resize; touch-action: none; }
        `}</style>
      )}
    </>
  );
}
