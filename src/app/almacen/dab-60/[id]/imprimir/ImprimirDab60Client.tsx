"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft, Eye, EyeOff } from "lucide-react";

type Orden = {
  id: number; numero: number; anio: number; fecha: string; tipo_compra: string;
  proveedor_nit: string | null; proveedor_nombre: string | null; total: number | null;
  no_compromiso: string | null;
  no_recibo_almacen: string | null; serie_recibo_almacen: string | null; encargado_almacen: string | null;
  fecha_ingreso_producto: string | null; no_factura: string | null; serie_factura: string | null;
  fecha_emision: string | null; lote: string | null; fecha_vencimiento: string | null;
  marca: string | null; modelo: string | null; serie: string | null;
};
type Renglon = { renglon: number | null; nombre: string; cantidad: number; total: number };

interface Props { orden: Orden; renglones: Renglon[] }

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const FONT = "Arial, Helvetica, sans-serif";

// El DAB-60 es un talonario pre-impreso: la hoja física ya trae las
// etiquetas y recuadros, aquí solo se imprime el TEXTO de cada dato en la
// posición donde le corresponde caer sobre el papel — sin bordes, logo ni
// firmantes. Las posiciones (mm desde la esquina superior izquierda de una
// hoja carta) son un punto de partida: ajústalas para que calcen con tu
// talonario real usando el modo "Ver posiciones" antes de imprimir.
const POS: Record<string, { top: number; left: number }> = {
  fecha:                { top: 22,  left: 150 },
  no_recibo_almacen:    { top: 22,  left: 40 },
  serie_recibo_almacen: { top: 22,  left: 90 },
  orden_compra:         { top: 30,  left: 40 },
  no_compromiso:        { top: 30,  left: 110 },
  proveedor_nombre:     { top: 40,  left: 40 },
  proveedor_nit:        { top: 40,  left: 150 },
  detalle:              { top: 60,  left: 25 },
  no_factura:           { top: 150, left: 40 },
  serie_factura:        { top: 150, left: 90 },
  fecha_emision:        { top: 150, left: 130 },
  lote:                 { top: 158, left: 40 },
  fecha_vencimiento:    { top: 158, left: 90 },
  marca:                { top: 166, left: 40 },
  modelo:               { top: 166, left: 90 },
  serie:                { top: 166, left: 140 },
  fecha_ingreso:        { top: 174, left: 40 },
  encargado_almacen:    { top: 250, left: 40 },
};

function Campo({ id, texto }: { id: string; texto: string }) {
  const p = POS[id];
  return (
    <div className="dab-campo" style={{ position: "absolute", top: `${p.top}mm`, left: `${p.left}mm`, fontSize: "9pt", whiteSpace: "nowrap" }}>
      {texto}
    </div>
  );
}

export default function ImprimirDab60Client({ orden: o, renglones }: Props) {
  const router = useRouter();
  const [verPosiciones, setVerPosiciones] = useState(false);
  const numeroOrden = `OC-${String(o.numero).padStart(3, "0")}/${o.anio}`;
  const total = renglones.reduce((s, r) => s + r.total, 0) || o.total || 0;
  const detalleTexto = renglones.map(r => `${r.renglon ?? "—"} · ${r.nombre} · ${r.cantidad.toLocaleString("es-GT")} · ${Q(r.total)}`).join("\n");

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">DAB-60 — {numeroOrden}</span>
        <div className="flex items-center gap-3 ml-auto">
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
        <div id="hoja" style={{ fontFamily: FONT, color: "#000" }}>
          <Campo id="fecha" texto={o.fecha} />
          <Campo id="no_recibo_almacen" texto={o.no_recibo_almacen ?? ""} />
          <Campo id="serie_recibo_almacen" texto={o.serie_recibo_almacen ?? ""} />
          <Campo id="orden_compra" texto={numeroOrden} />
          <Campo id="no_compromiso" texto={o.no_compromiso ?? ""} />
          <Campo id="proveedor_nombre" texto={o.proveedor_nombre ?? ""} />
          <Campo id="proveedor_nit" texto={o.proveedor_nit ?? ""} />
          <div className="dab-campo" style={{ position: "absolute", top: `${POS.detalle.top}mm`, left: `${POS.detalle.left}mm`, fontSize: "9pt", whiteSpace: "pre-line", lineHeight: 1.6 }}>
            {detalleTexto}
            {"\n"}Total: {Q(total)}
          </div>
          <Campo id="no_factura" texto={o.no_factura ?? ""} />
          <Campo id="serie_factura" texto={o.serie_factura ?? ""} />
          <Campo id="fecha_emision" texto={o.fecha_emision ?? ""} />
          <Campo id="lote" texto={o.lote ?? ""} />
          <Campo id="fecha_vencimiento" texto={o.fecha_vencimiento ?? ""} />
          <Campo id="marca" texto={o.marca ?? ""} />
          <Campo id="modelo" texto={o.modelo ?? ""} />
          <Campo id="serie" texto={o.serie ?? ""} />
          <Campo id="fecha_ingreso" texto={o.fecha_ingreso_producto ?? ""} />
          <Campo id="encargado_almacen" texto={o.encargado_almacen ?? ""} />
        </div>
      </div>

      <style>{`
        #print-wrapper {
          background: #94a3b8; display: flex; justify-content: center; align-items: flex-start;
          padding: 40px 20px; min-height: 100vh; margin-top: 52px; box-sizing: border-box;
        }
        #hoja {
          position: relative; background: white; width: 215.9mm; height: 279.4mm;
          box-shadow: 0 4px 32px rgba(0,0,0,0.22); box-sizing: border-box;
        }
        .no-print { display: block; }
        ${""/* En modo "ver posiciones" cada campo muestra un recuadro punteado y su
             nombre, para calibrar contra el papel físico antes de imprimir. */}
        ${""}
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
