"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft, ChevronDown, X } from "lucide-react";

type Orden = {
  id: number; numero: number; anio: number; fecha: string; tipo_compra: string;
  proveedor_nit: string | null; proveedor_nombre: string | null; total: number | null;
  no_compromiso: string | null;
  no_recibo_almacen: string | null; serie_recibo_almacen: string | null;
  fecha_ingreso_producto: string | null; no_factura: string | null; serie_factura: string | null;
  fecha_emision: string | null; lote: string | null; fecha_vencimiento: string | null;
  marca: string | null; modelo: string | null; serie: string | null;
};
type Renglon = { renglon: number | null; codigo_ppr: string | null; nombre: string; cantidad: number; total: number };
type Firmante = { id: number; nombre: string; cargo: string };

interface Props {
  orden: Orden;
  renglones: Renglon[];
  nombreUnidad: string; codigoUnidad: string;
  direccionUnidad: string; municipio: string;
  todosFirmantes: Firmante[]; firmantesSeleccionados: Firmante[];
}

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const FONT = "Arial, Helvetica, sans-serif";
const B = "1.5px solid #1a1a1a";
const R = "8px";
const C = "#000";

const FIRMA_SLOTS = ["Encargado de Almacén", "Quien Entrega", "Quien Recibe"] as const;

export default function ImprimirDab60Client({
  orden: o, renglones, nombreUnidad, codigoUnidad,
  direccionUnidad, municipio, todosFirmantes, firmantesSeleccionados: initFirmantes,
}: Props) {
  const router = useRouter();
  const numeroOrden = `OC-${String(o.numero).padStart(3, "0")}/${o.anio}`;
  const [firmantes, setFirmantes] = useState<Firmante[]>(initFirmantes);
  const [showSelector, setShowSelector] = useState(initFirmantes.length === 0);
  const [slot, setSlot] = useState<0 | 1 | 2>(0);

  function pickFirmante(idx: 0 | 1 | 2, f: Firmante) {
    setFirmantes(p => { const n = [...p]; n[idx] = f; return n; });
  }

  const total = renglones.reduce((s, r) => s + r.total, 0) || o.total || 0;

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">DAB-60 — {numeroOrden}</span>
        <div className="flex items-center gap-3 ml-auto">
          {[0, 1, 2].map(idx => (
            <button key={idx}
              onClick={() => { setSlot(idx as 0 | 1 | 2); setShowSelector(true); }}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50 max-w-[220px]">
              <span className="truncate">
                {firmantes[idx]
                  ? <><strong>{firmantes[idx].nombre}</strong> — {firmantes[idx].cargo}</>
                  : <span className="text-gray-400">{FIRMA_SLOTS[idx]}…</span>}
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

      {showSelector && (
        <div className="no-print fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="font-semibold text-sm">Selecciona firmante — {FIRMA_SLOTS[slot]}</p>
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

      <div id="print-wrapper">
        <div id="a4-sheet" style={{ fontFamily: FONT, color: C }}>

          {/* Encabezado: logo + forma + título */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
            <img src="/LOGO_SIAF01.svg" alt="IGSS" style={{ height: "48px", width: "auto", flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ margin: 0, fontWeight: "bold", fontSize: "12pt" }}>DOCUMENTO DE INGRESO A ALMACÉN</p>
            </div>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "9pt", flexShrink: 0, whiteSpace: "nowrap" }}>FORMA: DAB-60</p>
          </div>

          {/* Recuadro: Datos de la Unidad Ejecutora / Orden */}
          <div style={{ border: B, borderRadius: R, display: "flex", marginBottom: "10px", fontSize: "9pt" }}>
            <div style={{ flex: 1, padding: "10px 12px", borderRight: B }}>
              <p style={{ margin: "0 0 8px 0", fontWeight: "bold", textAlign: "center", fontSize: "8.5pt" }}>
                DATOS UNIDAD EJECUTORA / CENTRO DE COSTO
              </p>
              <div style={{ display: "flex", gap: "14px", marginBottom: "4px" }}>
                <span><strong>Orden de Compra:</strong> {numeroOrden}</span>
                <span><strong>Fecha:</strong> {o.fecha}</span>
                <span><strong>Código Unidad Ejecutora:</strong> {codigoUnidad}</span>
              </div>
              <p style={{ margin: "0 0 4px 0" }}>
                <strong>Nombre Unidad Ejecutora o Centro de Costo:</strong><br />
                <strong>{nombreUnidad}</strong>
              </p>
              <p style={{ margin: 0 }}>
                <strong>Dirección Unidad Ejecutora o centro de Costo:</strong> {direccionUnidad}, {municipio}
              </p>
            </div>
            <div style={{ width: "220px", flexShrink: 0, padding: "10px 12px" }}>
              <p style={{ margin: "0 0 8px 0", fontWeight: "bold", textAlign: "center", fontSize: "8.5pt" }}>RECIBO DE ALMACÉN</p>
              <p style={{ margin: "0 0 4px 0" }}><strong>No. de Recibo:</strong> {o.no_recibo_almacen ?? "—"}</p>
              <p style={{ margin: "0 0 4px 0" }}><strong>Serie:</strong> {o.serie_recibo_almacen ?? "—"}</p>
              <p style={{ margin: "0 0 4px 0" }}><strong>No. Compromiso:</strong> {o.no_compromiso ?? "—"}</p>
              <p style={{ margin: 0 }}><strong>Tipo de Compra:</strong> {o.tipo_compra}</p>
            </div>
          </div>

          {/* Recuadro: Datos del proveedor */}
          <div style={{ border: B, borderRadius: R, padding: "10px 12px", marginBottom: "10px", fontSize: "9pt" }}>
            <p style={{ margin: "0 0 8px 0", fontWeight: "bold", textAlign: "center", fontSize: "8.5pt" }}>DATOS DEL PROVEEDOR</p>
            <div style={{ display: "flex" }}>
              <span style={{ flex: 1 }}><strong>Nombre o Razón Social:</strong> {o.proveedor_nombre ?? "—"}</span>
              <span style={{ width: "180px", flexShrink: 0 }}><strong>NIT:</strong> {o.proveedor_nit ?? "—"}</span>
            </div>
          </div>

          {/* Recuadro: Detalle de bienes ingresados */}
          <div style={{ border: B, borderRadius: R, padding: "10px 12px", marginBottom: "10px", fontSize: "9pt" }}>
            <p style={{ margin: "0 0 8px 0", fontWeight: "bold", textAlign: "center", fontSize: "8.5pt" }}>
              DETALLE DE BIENES INGRESADOS
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt" }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>Código PpR</th>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>Renglón</th>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>Descripción</th>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>Cantidad</th>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>Precio Unitario</th>
                  <th style={{ border: "1px solid #333", padding: "4px" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {renglones.map((r, i) => (
                  <tr key={i}>
                    <td style={{ border: "1px solid #333", padding: "4px", textAlign: "center" }}>{r.codigo_ppr ?? "—"}</td>
                    <td style={{ border: "1px solid #333", padding: "4px", textAlign: "center" }}>{r.renglon ?? "—"}</td>
                    <td style={{ border: "1px solid #333", padding: "6px", fontWeight: "bold" }}>{r.nombre.toUpperCase()}</td>
                    <td style={{ border: "1px solid #333", padding: "4px", textAlign: "center" }}>{r.cantidad.toLocaleString("es-GT")}</td>
                    <td style={{ border: "1px solid #333", padding: "4px", textAlign: "right" }}>{Q(r.cantidad > 0 ? r.total / r.cantidad : 0)}</td>
                    <td style={{ border: "1px solid #333", padding: "4px", textAlign: "right" }}>{Q(r.total)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} style={{ border: "1px solid #333", padding: "4px", textAlign: "right", fontWeight: "bold" }}>Total</td>
                  <td style={{ border: "1px solid #333", padding: "4px", textAlign: "right", fontWeight: "bold" }}>{Q(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Recuadro: Datos adicionales (factura, lote, marca...) */}
          <div style={{ border: B, borderRadius: R, padding: "10px 12px", marginBottom: "10px", fontSize: "9pt" }}>
            <p style={{ margin: "0 0 8px 0", fontWeight: "bold", textAlign: "center", fontSize: "8.5pt" }}>DATOS ADICIONALES</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px" }}>
              <span><strong>Fecha de ingreso:</strong> {o.fecha_ingreso_producto ?? "—"}</span>
              <span><strong>No. Factura:</strong> {o.no_factura ?? "—"}</span>
              <span><strong>Serie Factura:</strong> {o.serie_factura ?? "—"}</span>
              <span><strong>Fecha de emisión:</strong> {o.fecha_emision ?? "—"}</span>
              <span><strong>Lote:</strong> {o.lote ?? "—"}</span>
              <span><strong>Fecha de vencimiento:</strong> {o.fecha_vencimiento ?? "—"}</span>
              <span><strong>Marca:</strong> {o.marca ?? "—"}</span>
              <span><strong>Modelo:</strong> {o.modelo ?? "—"}</span>
              <span><strong>Serie:</strong> {o.serie ?? "—"}</span>
            </div>
          </div>

          {/* Firmas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "20px" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ border: B, borderRadius: R, padding: "28px 10px 10px 10px", textAlign: "center", fontSize: "8.5pt" }}>
                <p style={{ margin: 0, fontWeight: "bold" }}>{firmantes[i]?.nombre || "—"}</p>
                <p style={{ margin: "2px 0 0 0" }}>{firmantes[i]?.cargo || FIRMA_SLOTS[i]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        #print-wrapper {
          background: #94a3b8; display: flex; justify-content: center; align-items: flex-start;
          padding: 40px 20px; min-height: 100vh; margin-top: 52px; box-sizing: border-box;
        }
        #a4-sheet {
          background: white; width: 297mm; min-height: 210mm; box-shadow: 0 4px 32px rgba(0,0,0,0.22);
          padding: 14mm; box-sizing: border-box;
        }
        .no-print { display: block; }
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .no-print { display: none !important; }
          #print-wrapper { background: white !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; display: block !important; }
          #a4-sheet { width: 100% !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
        }
      `}</style>
    </>
  );
}
