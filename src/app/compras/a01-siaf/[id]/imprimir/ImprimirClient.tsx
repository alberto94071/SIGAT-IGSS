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
const B = "2px solid #1a1a1a";
const R = "10px";
const C = "#000";

// Alturas fijas en px — calibradas para que el sheet tenga proporción A4 (1:1.41)
// Ancho = 210mm ≈ 794px en pantalla a 96dpi → alto objetivo ≈ 1123px
const H_BOX1 = 82;    // Logo + título
const H_BOX2 = 142;   // Datos de registro (más alto para que quepa Dirección con aire abajo)
const H_TABLE = 650;   // Tabla — el bloque más grande, da la proporción A4
const H_FIRMA = 90;    // Recuadros de firma
const H_JUST = 48;    // Justificación
const GAP = 5;     // px entre recuadros

const W_COD = 72;     // Ancho columna Código
const W_CANT = 88;     // Ancho columna Cantidad

export default function ImprimirClient({
  solicitud, items, config, todosFirmantes, firmantesSeleccionados: initFirmantes,
}: Props) {
  const router = useRouter();
  const [firmantes, setFirmantes] = useState<Firmante[]>(initFirmantes);
  const [showSelector, setShowSelector] = useState(initFirmantes.length === 0);
  const [slot, setSlot] = useState<0 | 1>(0);

  function pickFirmante(idx: 0 | 1, f: Firmante) {
    setFirmantes(p => { const n = [...p]; n[idx] = f; return n; });
  }

  const corrLabel = `${solicitud.numero}/${solicitud.anio}`;
  const totalGeneral = items.reduce((s, i) => s + i.cantidad_solicitada, 0);

  // Resumen: suma de cantidad_solicitada agrupada por subproducto
  const resumenSubproductos = Object.values(
    items.reduce((acc, item) => {
      const key = item.subproducto || "—";
      if (!acc[key]) acc[key] = { subproducto: key, cantidad: 0 };
      acc[key].cantidad += item.cantidad_solicitada;
      return acc;
    }, {} as Record<string, { subproducto: string; cantidad: number }>)
  );

  // Calcular cuántas filas vacías necesita la tabla para llenar el espacio fijo
  const HEADER_H = 26;
  const NOTA_H = 22;
  const SUBPROD_HEADER_H = 22;
  const SUBPROD_ROW_H = 18;
  const SUBPROD_MIN_ROWS = 6;
  const subprodRows = Math.max(SUBPROD_MIN_ROWS, resumenSubproductos.length);
  const subprodEmptyRows = subprodRows - resumenSubproductos.length;
  const SUBPROD_BODY_H = SUBPROD_ROW_H * subprodRows;
  const TOTAL_H = 24;
  const FOOTER_H = NOTA_H + SUBPROD_HEADER_H + SUBPROD_BODY_H + TOTAL_H;
  const ROW_H = 24;
  const rowsArea = H_TABLE - HEADER_H - FOOTER_H;
  const maxRows = Math.floor(rowsArea / ROW_H);
  const emptyRows = Math.max(0, maxRows - items.length);

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

      {/* ══════════════ HOJA A4 ══════════════ */}
      <div id="print-wrapper">
      <div id="a4-sheet">

        {/* ── RECUADRO 1: Logo + Título (sin línea divisora) ── */}
        <div style={{
          border: B, borderRadius: R, display: "flex", alignItems: "center",
          height: H_BOX1, marginBottom: GAP, overflow: "hidden",
        }}>
          {/* Logo — sin línea divisora */}
          <div style={{ width: "220px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 8px", height: "100%" }}>
            <img src="/LOGO_SIAF01.svg" alt="IGSS"
              style={{ height: `${H_BOX1 - 10}px`, width: "auto", maxWidth: "200px", objectFit: "contain", display: "block" }} />
          </div>
          {/* Títulos alineados a la derecha */}
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
          {/* Fecha + Correlativo: cada campo centrado en su mitad */}
          <div style={{ display: "flex", marginBottom: "7px" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "14px" }}>
              <span style={{ fontWeight: "bold", fontFamily: FONT, fontSize: "9.5pt", color: C }}>Fecha de Registro</span>
              <span style={{ fontFamily: FONT, fontSize: "9.5pt", color: C }}>{solicitud.fecha}</span>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
              <span style={{ fontWeight: "bold", fontFamily: FONT, fontSize: "9.5pt", color: C }}>Correlativo No.</span>
              <span style={{ fontWeight: "bold", fontFamily: FONT, fontSize: "11pt", color: C }}>{corrLabel}</span>
            </div>
          </div>

          <p style={{ fontWeight: "bold", fontSize: "8pt", margin: "0 0 6px 0", fontFamily: FONT, color: C }}>
            DATOS DE LA UNIDAD EJECUTORA, CENTRO COSTO, DEPENDENCIA o SERVICIO
          </p>

          {/* Nombre — label ancho para "doble TAB" entre él y el valor */}

          <div style={{ display: "flex", marginBottom: "6px", alignItems: "flex-start" }}>
            <span style={{ fontWeight: "bold", fontFamily: FONT, fontSize: "8.5pt", color: C, minWidth: "110px", flexShrink: 0 }}>
              Nombre:
            </span>
            <div style={{ fontFamily: FONT, fontSize: "8.5pt", color: C, lineHeight: 1.4 }}>
              <div>{config.nombre_unidad_ejecutora}</div>
              <div style={{ marginTop: "2px" }}>{config.centro_costo_nombre}</div>
            </div>
          </div>

          {/* Dirección — misma indentación que Nombre */}
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <span style={{ fontWeight: "bold", fontFamily: FONT, fontSize: "8.5pt", color: C, minWidth: "110px", flexShrink: 0 }}>
              Dirección:
            </span>
            <span style={{ fontFamily: FONT, fontSize: "8.5pt", color: C }}>{config.direccion_unidad}</span>
          </div>
        </div>

        {/* ── RECUADRO 3: Tabla — esquinas inferiores rectas en el original ── */}
        {/* usamos borderRadius solo arriba para coincidir con el original */}
        <div style={{
          border: B,
          borderRadius: `${R} ${R} 0 0`,   // solo esquinas superiores curvas
          height: H_TABLE, marginBottom: GAP,
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          {/* Encabezado + cuerpo comparten un mismo wrapper posicionado, con un único
              par de líneas verticales absolutas que corren de punta a punta —
              así la línea es una sola recta continua, sin desfase por box-sizing */}
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
              {items.map(item => (
                <div key={item.id} style={{ display: "flex", height: ROW_H, alignItems: "center", fontFamily: FONT, color: C }}>
                  <div style={{ width: W_COD, textAlign: "center", flexShrink: 0, fontFamily: "monospace", fontSize: "8pt" }}>
                    {item.codigo_igss ?? ""}
                  </div>
                  <div style={{ flex: 1, padding: "0 8px", display: "flex", justifyContent: "space-between", alignItems: "center", overflow: "hidden" }}>
                    <span style={{ textTransform: "uppercase", fontSize: "8pt", lineHeight: 1.2 }}>{item.nombre}</span>
                    <span style={{ fontSize: "7.5pt", color: "#333", whiteSpace: "nowrap", marginLeft: "8px", flexShrink: 0 }}>
                      {item.subproducto}
                    </span>
                  </div>
                  <div style={{ width: W_CANT, textAlign: "center", flexShrink: 0, fontSize: "9pt" }}>
                    {item.cantidad_solicitada.toLocaleString("es-GT")}
                  </div>
                </div>
              ))}

              {Array.from({ length: emptyRows }).map((_, i) => (
                <div key={`e${i}`} style={{ height: ROW_H }} />
              ))}
            </div>
          </div>

          {/* Nota */}
          <div style={{ borderTop: "1px solid #bbb", height: NOTA_H, display: "flex", alignItems: "center", padding: "0 8px", flexShrink: 0 }}>
            <span style={{ fontSize: "6.5pt", color: "#555", fontFamily: FONT }}>
              Los productos de los listados institucionales, se encuentran homologados con el catálogo general de insumos del SIGES, Presupuesto por Resultados (PpR)
            </span>
          </div>

          {/* Footer: Código de Subproducto + Total con línea vertical continua */}
          <div style={{ borderTop: B, flexShrink: 0, position: "relative" }}>
            {/* Línea vertical continua, exactamente a la mitad del recuadro */}
            <div style={{ position: "absolute", left: "50%", marginLeft: "-1px", top: 0, bottom: 0, width: "2px", background: "#1a1a1a", zIndex: 1 }} />

            {/* Fila encabezado */}
            <div style={{ display: "flex", height: SUBPROD_HEADER_H, alignItems: "center", fontWeight: "bold", fontSize: "8.5pt", fontFamily: FONT, color: C }}>
              <div style={{ flex: 1, textAlign: "center" }}>Código de Subproducto</div>
              <div style={{ flex: 1, textAlign: "center" }}>Cantidad por Subproducto</div>
            </div>

            {/* Separador horizontal entre encabezado y filas del resumen */}
            <div style={{ borderTop: B }} />

            {/* Cuerpo: resumen — suma de cantidad solicitada por subproducto */}
            <div style={{ height: SUBPROD_BODY_H }}>
              {resumenSubproductos.map((r, i) => (
                <div key={r.subproducto} style={{
                  display: "flex", height: SUBPROD_ROW_H, alignItems: "center",
                  fontSize: "8pt", fontFamily: FONT, color: C,
                  borderTop: i === 0 ? "none" : "1px solid #ccc",
                }}>
                  <div style={{ flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 6px" }}>
                    {r.subproducto}
                  </div>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    {r.cantidad.toLocaleString("es-GT")}
                  </div>
                </div>
              ))}
              {Array.from({ length: subprodEmptyRows }).map((_, i) => (
                <div key={`se${i}`} style={{
                  display: "flex", height: SUBPROD_ROW_H,
                  borderTop: (resumenSubproductos.length + i) === 0 ? "none" : "1px solid #ccc",
                }} />
              ))}
            </div>

            {/* Separador horizontal entre el resumen y Total */}
            <div style={{ borderTop: B }} />

            {/* Fila Total */}
            <div style={{ display: "flex", height: TOTAL_H, alignItems: "center", fontFamily: FONT, color: C }}>
              <div style={{ flex: 1, textAlign: "right", paddingRight: "14px", fontWeight: "bold", fontSize: "9pt" }}>Total</div>
              <div style={{ flex: 1, textAlign: "center", fontWeight: "bold", fontSize: "10pt" }}>
                {totalGeneral.toLocaleString("es-GT")}
              </div>
            </div>
          </div>
        </div>

        {/* ── Firmas ── */}
        <div style={{ display: "flex", gap: "12px", height: H_FIRMA, marginBottom: GAP }}>
          {[0, 1].map(idx => (
            <div key={idx} style={{ flex: 1, border: B, borderRadius: R, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 14px 10px" }}>
              <div style={{ width: "100%", borderTop: "1.5px solid #222", paddingTop: "5px", textAlign: "center" }}>
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
          padding: "6px 12px", boxSizing: "border-box",
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
          <span>Fecha de impresión: {new Date().toLocaleDateString("es-GT")}</span>
          <span>Hoja 1 de 1</span>
        </div>

      </div>
    </div >

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
