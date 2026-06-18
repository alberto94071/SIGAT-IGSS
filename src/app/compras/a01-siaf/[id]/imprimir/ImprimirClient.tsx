"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ChevronDown, X, ArrowLeft } from "lucide-react";

type Item = {
  id: number; nombre: string; codigo_igss: number | null; codigo_ppr: string | null;
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
}

const FONT = "Arial, Helvetica, sans-serif";
const B    = "2px solid #1a1a1a";
const R    = "10px";
const C    = "#000";

// Alturas fijas en px (la hoja siempre ocupa lo mismo)
const H_BOX1  = 78;   // Logo + título
const H_BOX2  = 108;  // Datos de registro
const H_TABLE = 380;  // Tabla de insumos (siempre fijo)
const H_FIRMA = 88;   // Recuadros de firma
const H_JUST  = 44;   // Justificación
const GAP     = 5;    // Espacio entre recuadros

// Ancho fijo de columnas en la tabla
const W_COD  = 70;
const W_CANT = 85;

export default function ImprimirClient({
  solicitud, items, config, todosFirmantes, firmantesSeleccionados: initFirmantes,
}: Props) {
  const router = useRouter();
  const [firmantes,    setFirmantes]    = useState<Firmante[]>(initFirmantes);
  const [showSelector, setShowSelector] = useState(initFirmantes.length === 0);
  const [slot,         setSlot]         = useState<0 | 1>(0);

  function pickFirmante(idx: 0 | 1, f: Firmante) {
    setFirmantes(p => { const n = [...p]; n[idx] = f; return n; });
  }

  const corrLabel    = `${solicitud.numero}/${solicitud.anio}`;
  const totalGeneral = items.reduce((s, i) => s + i.cantidad_solicitada, 0);

  // Filas para llenar la tabla (siempre el mismo alto total)
  const HEADER_H = 26;
  const FOOTER_H = 26 + 24 + 24; // nota + encabezado sub + total
  const ROW_H    = 24;
  const rowsArea = H_TABLE - HEADER_H - FOOTER_H;
  const maxRows  = Math.floor(rowsArea / ROW_H);
  const emptyRows = Math.max(0, maxRows - items.length);

  return (
    <>
      {/* ── Barra controles ── */}
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

      {/* ══════════════ HOJA A4 ══════════════ */}
      <div id="print-wrapper">
        <div id="a4-sheet">

          {/* ── RECUADRO 1: Logo + Título ── */}
          <div style={{ border: B, borderRadius: R, display: "flex", alignItems: "stretch", height: H_BOX1, marginBottom: GAP, overflow: "hidden" }}>
            {/* Logo — grande, sin texto */}
            <div style={{ width: "120px", flexShrink: 0, borderRight: "1px solid #bbb", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 8px" }}>
              <img src="/LOGO_SIAF01.svg" alt="IGSS"
                style={{ height: `${H_BOX1 - 12}px`, width: "auto", objectFit: "contain", display: "block" }} />
            </div>
            {/* Títulos alineados a la derecha */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", paddingRight: "20px" }}>
              <p style={{ margin: "0 0 3px 0", fontWeight: "bold", fontSize: "15pt", fontFamily: FONT, color: C }}>
                FORMA A-01 SIAF
              </p>
              <p style={{ margin: 0, fontWeight: "bold", fontSize: "13pt", fontFamily: FONT, color: C }}>
                SOLICITUD DE COMPRA DE BIENES Y/O SERVICIOS
              </p>
            </div>
          </div>

          {/* ── RECUADRO 2: Datos de registro ── */}
          <div style={{ border: B, borderRadius: R, height: H_BOX2, marginBottom: GAP, padding: "8px 14px", boxSizing: "border-box", overflow: "hidden" }}>
            {/* Fecha y correlativo: cada uno centrado en su mitad */}
            <div style={{ display: "flex", marginBottom: "6px" }}>
              <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: "16px" }}>
                <span style={{ fontWeight: "bold", fontFamily: FONT, fontSize: "9.5pt", color: C }}>Fecha de Registro</span>
                <span style={{ fontFamily: FONT, fontSize: "9.5pt", color: C }}>{solicitud.fecha}</span>
              </div>
              <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: "14px" }}>
                <span style={{ fontWeight: "bold", fontFamily: FONT, fontSize: "9.5pt", color: C }}>Correlativo No.</span>
                <span style={{ fontWeight: "bold", fontFamily: FONT, fontSize: "11pt", color: C }}>{corrLabel}</span>
              </div>
            </div>

            <p style={{ fontWeight: "bold", fontSize: "8pt", margin: "0 0 5px 0", fontFamily: FONT, color: C }}>
              DATOS DE LA UNIDAD EJECUTORA, CENTRO COSTO, DEPENDENCIA o SERVICIO
            </p>

            {/* Nombre y Dirección con label de ancho fijo y valor a 2.5cm */}
            <div style={{ display: "flex", marginBottom: "5px", alignItems: "flex-start" }}>
              <span style={{ fontWeight: "bold", fontFamily: FONT, fontSize: "8.5pt", color: C, minWidth: "65px", paddingRight: "8px" }}>Nombre:</span>
              <div style={{ fontFamily: FONT, fontSize: "8.5pt", color: C, lineHeight: 1.35 }}>
                <div>{config.nombre_unidad_ejecutora}</div>
                <div style={{ marginTop: "2px" }}>{config.centro_costo_nombre}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <span style={{ fontWeight: "bold", fontFamily: FONT, fontSize: "8.5pt", color: C, minWidth: "65px", paddingRight: "8px" }}>Dirección:</span>
              <span style={{ fontFamily: FONT, fontSize: "8.5pt", color: C }}>{config.direccion_unidad}</span>
            </div>
          </div>

          {/* ── RECUADRO 3: Tabla ── altura fija */}
          <div style={{ border: B, borderRadius: R, height: H_TABLE, marginBottom: GAP, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>

            {/* Encabezado */}
            <div style={{ display: "flex", borderBottom: B, height: HEADER_H, alignItems: "center", flexShrink: 0, fontWeight: "bold", fontSize: "9pt", fontFamily: FONT, color: C, background: "white" }}>
              <div style={{ width: W_COD, textAlign: "center", flexShrink: 0 }}>Código</div>
              <div style={{ flex: 1, textAlign: "center" }}>Descripción</div>
              <div style={{ width: W_CANT, textAlign: "center", flexShrink: 0 }}>Cantidad</div>
            </div>

            {/* Cuerpo: posición relativa para líneas verticales absolutas */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
              {/* Línea vertical izquierda (después de Código) */}
              <div style={{ position: "absolute", left: W_COD, top: 0, bottom: 0, width: "2px", background: "#1a1a1a", zIndex: 1 }} />
              {/* Línea vertical derecha (antes de Cantidad) */}
              <div style={{ position: "absolute", right: W_CANT, top: 0, bottom: 0, width: "2px", background: "#1a1a1a", zIndex: 1 }} />

              {/* Filas de insumos */}
              {items.map(item => (
                <div key={item.id} style={{ display: "flex", height: ROW_H, alignItems: "center", fontFamily: FONT, fontSize: "8.5pt", color: C }}>
                  <div style={{ width: W_COD, textAlign: "center", flexShrink: 0, fontFamily: "monospace", fontSize: "8pt" }}>
                    {item.codigo_igss ?? ""}
                  </div>
                  <div style={{ flex: 1, padding: "0 8px", display: "flex", justifyContent: "space-between", alignItems: "center", overflow: "hidden" }}>
                    <span style={{ textTransform: "uppercase", fontSize: "8pt" }}>{item.nombre}</span>
                    <span style={{ fontSize: "7.5pt", color: "#333", whiteSpace: "nowrap", marginLeft: "8px", flexShrink: 0 }}>
                      {item.subproducto}
                    </span>
                  </div>
                  <div style={{ width: W_CANT, textAlign: "center", flexShrink: 0 }}>
                    {item.cantidad_solicitada.toLocaleString("es-GT")}
                  </div>
                </div>
              ))}

              {/* Filas vacías */}
              {Array.from({ length: emptyRows }).map((_, i) => (
                <div key={`e${i}`} style={{ height: ROW_H }} />
              ))}
            </div>

            {/* Nota homologados */}
            <div style={{ borderTop: "1px solid #bbb", height: 24, display: "flex", alignItems: "center", padding: "0 8px", flexShrink: 0 }}>
              <span style={{ fontSize: "6.5pt", color: "#555", fontFamily: FONT }}>
                Los productos de los listados institucionales, se encuentran homologados con el catálogo general de insumos del SIGES, Presupuesto por Resultados (PpR)
              </span>
            </div>

            {/* Encabezado subproducto/cantidad */}
            <div style={{ borderTop: B, height: 26, display: "flex", alignItems: "center", flexShrink: 0, fontWeight: "bold", fontSize: "8.5pt", fontFamily: FONT, color: C }}>
              <div style={{ flex: 1, textAlign: "center", borderRight: B }}>Código de Subproducto</div>
              <div style={{ width: 140, textAlign: "center", flexShrink: 0 }}>Cantidad por Subproducto</div>
            </div>

            {/* Total */}
            <div style={{ height: 24, display: "flex", alignItems: "center", flexShrink: 0, fontFamily: FONT, color: C }}>
              <div style={{ flex: 1, textAlign: "right", paddingRight: "12px", fontWeight: "bold", fontSize: "9pt", borderRight: B }}>Total</div>
              <div style={{ width: 140, textAlign: "center", fontWeight: "bold", fontSize: "10pt", flexShrink: 0 }}>
                {totalGeneral.toLocaleString("es-GT")}
              </div>
            </div>
          </div>

          {/* ── Firmas ── */}
          <div style={{ display: "flex", gap: "12px", height: H_FIRMA, marginBottom: GAP }}>
            {[0, 1].map(idx => (
              <div key={idx} style={{ flex: 1, border: B, borderRadius: R, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 14px 10px" }}>
                <div style={{ width: "100%", borderTop: "1.5px solid #222", paddingTop: "5px", textAlign: "center" }}>
                  <p style={{ margin: "0 0 2px 0", fontWeight: "bold", fontSize: "9.5pt", textTransform: "uppercase", fontFamily: FONT, color: C }}>
                    {firmantes[idx]?.nombre ?? ""}
                  </p>
                  <p style={{ margin: 0, fontSize: "9pt", fontFamily: FONT, color: C }}>
                    {firmantes[idx]?.cargo ?? ""}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Justificación: label izquierda + texto derecha ── */}
          <div style={{ border: B, borderRadius: R, height: H_JUST, marginBottom: GAP, padding: "6px 12px", boxSizing: "border-box", display: "flex", alignItems: "flex-start", gap: "6px", overflow: "hidden" }}>
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
            <span>Fecha de impresión: {new Date().toLocaleDateString("es-GT")}</span>
            <span>Hoja 1 de 1</span>
          </div>

        </div>
      </div>

      <style>{`
        #print-wrapper {
          background: #94a3b8;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 40px 20px;
          min-height: 100vh;
          margin-top: 52px;
          box-sizing: border-box;
        }
        #a4-sheet {
          background: white;
          width: 210mm;
          box-shadow: 0 4px 32px rgba(0,0,0,0.22);
          padding: 10mm 12mm 8mm 12mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        .no-print { display: block; }

        @media print {
          @page { size: A4 portrait; margin: 8mm 10mm; }
          .no-print { display: none !important; }
          #print-wrapper {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            min-height: 0 !important;
            display: block !important;
          }
          #a4-sheet {
            width: 100% !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </>
  );
}
