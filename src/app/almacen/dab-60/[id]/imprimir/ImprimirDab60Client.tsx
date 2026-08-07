"use client";
import { useState, useRef, useEffect, useCallback, type RefObject } from "react";
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
  posicionesGuardadas: Record<string, { top: number; left: number }>;
}

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const FONT = "Arial, Helvetica, sans-serif";

const HOJA_W_MM = 215.9;
const HOJA_H_MM = 279.4;
const ROW_H_MM = 5.5;

type Pos = { top: number; left: number };

// Posiciones por defecto (mm desde la esquina superior izquierda de la hoja
// carta) — punto de partida calibrado contra un DAB-60 real. Se guarda lo que
// el usuario arrastre en el modo "Ver posiciones"; lo que no se haya
// guardado todavía usa estos valores.
const POS_DEFAULT: Record<string, Pos> = {
  lugar_fecha:           { top: 25,  left: 45 },
  no_recibo_almacen:     { top: 28,  left: 150 },
  serie_recibo_almacen:  { top: 33,  left: 150 },
  no_factura:            { top: 38,  left: 150 },
  dependencia:           { top: 46,  left: 45 },
  clave_administrativa:  { top: 46,  left: 178 },
  orden_compra:          { top: 58,  left: 45 },
  a01_siaf:              { top: 58,  left: 95 },
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
  descripcion:           { top: 128, left: 20 },
  encargado_almacen:     { top: 141, left: 45 },
  fecha_emision:         { top: 250, left: 20 },
  fecha_ingreso:         { top: 250, left: 75 },
  modelo:                { top: 250, left: 130 },
  serie:                 { top: 256, left: 20 },
  serie_factura:         { top: 256, left: 75 },
  proveedor_nit:         { top: 256, left: 130 },
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
    onChange(id, { top: Math.max(0, d.startTop + dy), left: Math.max(0, d.startLeft + dx) });
  }, [id, onChange]);

  const onPointerUp = useCallback(() => { draggingRef.current = null; }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}

function Campo({
  id, texto, hojaRef, pos, onChange, editable, style,
}: {
  id: string; texto: string; hojaRef: RefObject<HTMLDivElement | null>; pos: Pos;
  onChange: (id: string, pos: Pos) => void; editable: boolean; style?: React.CSSProperties;
}) {
  const { onPointerDown, onPointerMove, onPointerUp } = useDrag(hojaRef, id, pos, onChange, editable);
  const contenido = editable && !texto ? `⟨${id}⟩` : texto;
  return (
    <div
      className="dab-campo"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      style={{
        position: "absolute", top: `${pos.top}mm`, left: `${pos.left}mm`,
        fontSize: "9pt", whiteSpace: "nowrap", fontFamily: FONT, color: "#000",
        cursor: editable ? "grab" : undefined, touchAction: editable ? "none" : undefined,
        ...style,
      }}
    >
      {contenido}
    </div>
  );
}

function ColumnaCampo({
  id, valores, hojaRef, pos, onChange, editable, align = "left",
}: {
  id: string; valores: string[]; hojaRef: RefObject<HTMLDivElement | null>; pos: Pos;
  onChange: (id: string, pos: Pos) => void; editable: boolean; align?: "left" | "right" | "center";
}) {
  const { onPointerDown, onPointerMove, onPointerUp } = useDrag(hojaRef, id, pos, onChange, editable);
  const lineas = valores.length > 0 ? valores : (editable ? [`⟨${id}⟩`] : [""]);
  return (
    <div
      className="dab-campo"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      style={{
        position: "absolute", top: `${pos.top}mm`, left: `${pos.left}mm`,
        cursor: editable ? "grab" : undefined, touchAction: editable ? "none" : undefined,
      }}
    >
      {lineas.map((v, i) => (
        <div key={i} style={{ height: `${ROW_H_MM}mm`, fontSize: "9pt", whiteSpace: "nowrap", fontFamily: FONT, color: "#000", textAlign: align }}>
          {v}
        </div>
      ))}
    </div>
  );
}

export default function ImprimirDab60Client({ orden: o, renglones, datos, posicionesGuardadas }: Props) {
  const router = useRouter();
  const [verPosiciones, setVerPosiciones] = useState(false);
  const [pos, setPos] = useState<Record<string, Pos>>({ ...POS_DEFAULT, ...posicionesGuardadas });
  const [fondo, setFondo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const hojaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (verPosiciones && !fondo) getFondoDab60().then(setFondo);
  }, [verPosiciones, fondo]);

  const onChangePos = useCallback((id: string, next: Pos) => {
    setPos(p => ({ ...p, [id]: next }));
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

  const numeroOrden = `OC-${String(o.numero).padStart(3, "0")}/${o.anio}`;

  const cantidades       = renglones.map(r => r.cantidad.toLocaleString("es-GT"));
  const unidades         = renglones.map(r => r.unidad_medida ?? "");
  const codigos          = renglones.map(r => r.codigo ?? "");
  const codigosPpr       = renglones.map(r => r.codigo_igss && r.codigo_ppr ? `${r.codigo_igss}-${r.codigo_ppr}` : "");
  const vUnitarios       = renglones.map(r => r.cantidad > 0
    ? (r.total / r.cantidad).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 8 })
    : "");
  const valoresTotales   = renglones.map(r => Q(r.total));

  const campo = (id: string, texto: string, style?: React.CSSProperties) => (
    <Campo id={id} texto={texto} hojaRef={hojaRef} pos={pos[id] ?? POS_DEFAULT[id]} onChange={onChangePos} editable={verPosiciones} style={style} />
  );
  const columna = (id: string, valores: string[], align?: "left" | "right" | "center") => (
    <ColumnaCampo id={id} valores={valores} hojaRef={hojaRef} pos={pos[id] ?? POS_DEFAULT[id]} onChange={onChangePos} editable={verPosiciones} align={align} />
  );

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">DAB-60 — {numeroOrden}</span>
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
          {verPosiciones && fondo && (
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
          {campo("descripcion", datos.descripcion, { whiteSpace: "pre-line", width: "150mm", lineHeight: 1.5 })}
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
          .dab-campo { outline: 1px dashed #f43f5e; background: rgba(244,63,94,0.06); padding: 1px 2px; }
        `}</style>
      )}
    </>
  );
}
