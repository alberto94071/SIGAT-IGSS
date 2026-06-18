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

// Estilos base compartidos
const FONT  = "Arial, Helvetica, sans-serif";
const COLOR = "#000";
const B     = "2px solid #1a1a1a";
const R     = "10px";

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
  const MIN_ROWS     = 9;
  const emptyRows    = Math.max(0, MIN_ROWS - items.length);

  return (
    <>
      {/* ── Barra de controles (se oculta al imprimir por print:hidden del DashboardShell) ── */}
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

      {/* Selector de firmante */}
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

      {/* ════════════════════════════════════════════
          HOJA A4
      ════════════════════════════════════════════ */}
      <div id="print-wrapper" style={{ background: "#94a3b8", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "40px 20px 40px", minHeight: "100vh", marginTop: "52px" }}>
        <div id="a4-sheet" style={{
          background: "white",
          width: "210mm",
          minHeight: "297mm",
          boxShadow: "0 4px 32px rgba(0,0,0,0.22)",
          padding: "12mm 13mm 10mm 13mm",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          fontFamily: FONT,
          color: COLOR,
          fontSize: "9.5pt",
        }}>

          {/* ══ RECUADRO 1: Logo + Título ══ */}
          <div style={{ border: B, borderRadius: R, display: "flex", alignItems: "stretch", minHeight: "62px" }}>
            {/* Logo sin texto — el SVG ya lo trae */}
            <div style={{ padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "center", minWidth: "90px", borderRight: "1px solid #bbb" }}>
              <img src="/LOGO_SIAF01.svg" alt="IGSS"
                style={{ width: "58px", height: "54px", objectFit: "contain", display: "block" }} />
            </div>
            {/* Títulos alineados a la derecha */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", paddingRight: "16px", paddingLeft: "12px" }}>
              <p style={{ margin: "0 0 2px 0", fontWeight: "bold", fontSize: "14pt", fontFamily: FONT }}>
                FORMA A-01 SIAF
              </p>
              <p style={{ margin: 0, fontWeight: "bold", fontSize: "13pt", fontFamily: FONT }}>
                SOLICITUD DE COMPRA DE BIENES Y/O SERVICIOS
              </p>
            </div>
          </div>

          {/* ══ RECUADRO 2: Datos de registro ══ */}
          <div style={{ border: B, borderRadius: R, padding: "7px 12px" }}>
            {/* Fecha y Correlativo — menos gap entre la fecha y "Correlativo No." */}
            <div style={{ display: "flex", gap: "30px", marginBottom: "5px" }}>
              <p style={{ margin: 0, fontSize: "9.5pt" }}>
                <strong>Fecha de Registro</strong>
                <span style={{ marginLeft: "16px" }}>{solicitud.fecha}</span>
              </p>
              <p style={{ margin: 0, fontSize: "9.5pt" }}>
                <strong>Correlativo No.</strong>
                <span style={{ marginLeft: "12px", fontWeight: "bold", fontSize: "10.5pt" }}>{corrLabel}</span>
              </p>
            </div>

            <p style={{ margin: "0 0 5px 0", fontWeight: "bold", fontSize: "8.5pt" }}>
              DATOS DE LA UNIDAD EJECUTORA, CENTRO COSTO, DEPENDENCIA o SERVICIO
            </p>

            {/* Nombre con label fijo de 76px — más espacio hacia el valor */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt" }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: "bold", whiteSpace: "nowrap", width: "76px", verticalAlign: "top", paddingBottom: "3px" }}>Nombre:</td>
                  <td style={{ paddingBottom: "3px", lineHeight: "1.35" }}>
                    <div>{config.nombre_unidad_ejecutora}</div>
                    <div style={{ marginTop: "1px" }}>{config.centro_costo_nombre}</div>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold", whiteSpace: "nowrap", verticalAlign: "top" }}>Dirección:</td>
                  <td>{config.direccion_unidad}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ══ RECUADRO 3: Tabla ══ */}
          <div style={{ border: B, borderRadius: R, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>

            {/* Encabezado — con bordes verticales entre columnas */}
            <div style={{ display: "flex", borderBottom: B, fontWeight: "bold", fontSize: "9pt", background: "white" }}>
              <div style={{ width: "68px", padding: "4px 6px", textAlign: "center", borderRight: B, flexShrink: 0 }}>Código</div>
              <div style={{ flex: 1, padding: "4px 8px", textAlign: "center" }}>Descripción</div>
              <div style={{ width: "68px", padding: "4px 6px", textAlign: "center", borderLeft: B, flexShrink: 0 }}>Cantidad</div>
            </div>

            {/* Filas de insumos — sin bordes horizontales internos */}
            <div style={{ flex: 1 }}>
              {items.map(item => (
                <div key={item.id} style={{ display: "flex", fontSize: "9pt", minHeight: "22px", alignItems: "flex-start" }}>
                  <div style={{ width: "68px", padding: "3px 6px", textAlign: "center", fontFamily: "monospace", flexShrink: 0, borderRight: B }}>
                    {item.codigo_igss ?? ""}
                  </div>
                  <div style={{ flex: 1, padding: "3px 8px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ fontWeight: 500, textTransform: "uppercase" }}>{item.nombre}</span>
                    <span style={{ fontSize: "8pt", color: "#444", whiteSpace: "nowrap", marginLeft: "8px" }}>
                      {item.codigo_ppr ?? ""}
                    </span>
                  </div>
                  <div style={{ width: "68px", padding: "3px 6px", textAlign: "center", flexShrink: 0, borderLeft: B }}>
                    {item.cantidad_solicitada.toLocaleString("es-GT")}
                  </div>
                </div>
              ))}
              {/* Filas vacías */}
              {Array.from({ length: emptyRows }).map((_, i) => (
                <div key={`e${i}`} style={{ display: "flex", minHeight: "22px" }}>
                  <div style={{ width: "68px", borderRight: B, flexShrink: 0 }}></div>
                  <div style={{ flex: 1 }}></div>
                  <div style={{ width: "68px", borderLeft: B, flexShrink: 0 }}></div>
                </div>
              ))}
            </div>

            {/* Nota homologados */}
            <div style={{ borderTop: "1px solid #bbb", padding: "2px 8px", fontSize: "7pt", color: "#555" }}>
              Los productos de los listados institucionales, se encuentran homologados con el catálogo general de insumos del SIGES, Presupuesto por Resultados (PpR)
            </div>

            {/* Sección inferior: encabezado + Total (sin fila intermedia vacía) */}
            <div style={{ borderTop: B }}>
              {/* Encabezado: columna izq amplia, columna der 140px */}
              <div style={{ display: "flex", borderBottom: "1px solid #888", fontWeight: "bold", fontSize: "8.5pt" }}>
                <div style={{ flex: 1, padding: "3px 8px", textAlign: "center", borderRight: B }}>
                  Código de Subproducto
                </div>
                <div style={{ width: "140px", padding: "3px 8px", textAlign: "center", flexShrink: 0 }}>
                  Cantidad por Subproducto
                </div>
              </div>
              {/* Total — directo, sin fila vacía */}
              <div style={{ display: "flex", fontSize: "9pt" }}>
                <div style={{ flex: 1, padding: "3px 8px", textAlign: "right", fontWeight: "bold", borderRight: B }}>
                  Total
                </div>
                <div style={{ width: "140px", padding: "3px 8px", textAlign: "center", fontWeight: "bold", fontSize: "10pt", flexShrink: 0 }}>
                  {totalGeneral.toLocaleString("es-GT")}
                </div>
              </div>
            </div>
          </div>

          {/* ══ Firmas ══ */}
          <div style={{ display: "flex", gap: "12px" }}>
            {[0, 1].map(idx => (
              <div key={idx} style={{ flex: 1, border: B, borderRadius: R, padding: "34px 14px 10px", textAlign: "center" }}>
                <div style={{ borderTop: "1.5px solid #222", paddingTop: "5px" }}>
                  <p style={{ margin: "0 0 1px 0", fontWeight: "bold", fontSize: "9pt", textTransform: "uppercase" }}>
                    {firmantes[idx]?.nombre ?? ""}
                  </p>
                  <p style={{ margin: 0, fontSize: "9pt" }}>
                    {firmantes[idx]?.cargo ?? <span style={{ color: "#ccc" }}>Firmante {idx + 1}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ══ Justificación ══ */}
          <div style={{ border: B, borderRadius: R, padding: "5px 12px", fontSize: "9pt" }}>
            <strong>JUSTIFICACIÓN: </strong>
            <span style={{ textTransform: "uppercase" }}>{config.justificacion_siaf}</span>
          </div>

          {/* Pie */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "7.5pt", color: "#666", paddingTop: "2px" }}>
            <span>ID: {solicitud.id}</span>
            <span>Fecha de impresión: {new Date().toLocaleDateString("es-GT")}</span>
            <span>Hoja 1 de 1</span>
          </div>

        </div>
      </div>

      <style>{`
        /* Ocultar barra propia en print */
        @media print {
          @page { size: A4 portrait; margin: 8mm 10mm; }

          /* Ocultar todo lo que no es la hoja */
          .no-print { display: none !important; }

          /* Quitar el wrapper gris y el padding */
          #print-wrapper {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            min-height: 0 !important;
            display: block !important;
          }

          /* La hoja ocupa todo el ancho imprimible */
          #a4-sheet {
            width: 100% !important;
            min-height: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </>
  );
}
