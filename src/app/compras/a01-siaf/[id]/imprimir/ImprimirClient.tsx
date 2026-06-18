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

const B = "2px solid #222";           // borde estándar
const RADIUS = "10px";                 // bordes redondeados
const FONT = "'Arial', sans-serif";
const COLOR = "#111";

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
  const MIN_ROWS = 9;
  const emptyRows = Math.max(0, MIN_ROWS - items.length);

  return (
    <>
      {/* ── Barra de controles ── */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">Forma A-01 SIAF — {corrLabel}</span>
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

      {/* ══════════════════════════════════════════
          HOJA A4 — lo único que se imprime
      ══════════════════════════════════════════ */}
      <div className="page-wrapper">
        <div className="a4-sheet">

          {/* ── RECUADRO 1: Logo + Título ── */}
          <div style={{ border: B, borderRadius: RADIUS, display: "flex", alignItems: "stretch", marginBottom: "6px" }}>

            {/* Logo */}
            <div style={{ padding: "6px 10px 6px 8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: "95px" }}>
              <img src="/LOGO_SIAF01.svg" alt="IGSS"
                style={{ width: "44px", height: "44px", objectFit: "contain", display: "block" }} />
              <p style={{ fontSize: "5.5pt", textAlign: "center", color: COLOR, margin: "2px 0 0 0", lineHeight: 1.2, fontFamily: FONT }}>
                Instituto Guatemalteco de<br />Seguridad Social
              </p>
            </div>

            {/* Títulos — alineados a la derecha con espacio del borde */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingRight: "18px", textAlign: "right" }}>
              <p style={{ fontWeight: "bold", fontSize: "14pt", margin: "0 0 3px 0", fontFamily: FONT, color: COLOR }}>
                FORMA A-01 SIAF
              </p>
              <p style={{ fontWeight: "bold", fontSize: "11pt", margin: 0, fontFamily: FONT, color: COLOR }}>
                SOLICITUD DE COMPRA DE BIENES Y/O SERVICIOS
              </p>
            </div>
          </div>

          {/* ── RECUADRO 2: Datos de registro ── */}
          <div style={{ border: B, borderRadius: RADIUS, padding: "8px 14px 8px 14px", marginBottom: "6px" }}>

            {/* Fecha + Correlativo distribuidos */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
              <p style={{ margin: 0, fontFamily: FONT, color: COLOR, fontSize: "10pt" }}>
                <strong>Fecha de Registro</strong>
                <span style={{ marginLeft: "24px" }}>{solicitud.fecha}</span>
              </p>
              <p style={{ margin: 0, fontFamily: FONT, color: COLOR, fontSize: "10pt" }}>
                <strong>Correlativo No.</strong>
                <span style={{ marginLeft: "16px", fontWeight: "bold", fontSize: "11pt" }}>{corrLabel}</span>
              </p>
            </div>

            <p style={{ fontWeight: "bold", fontSize: "9pt", margin: "0 0 4px 0", fontFamily: FONT, color: COLOR }}>
              DATOS DE LA UNIDAD EJECUTORA, CENTRO COSTO, DEPENDENCIA o SERVICIO
            </p>

            {/* Nombre */}
            <div style={{ display: "flex", marginBottom: "3px" }}>
              <span style={{ fontWeight: "bold", whiteSpace: "nowrap", minWidth: "70px", fontFamily: FONT, color: COLOR, fontSize: "9.5pt" }}>
                Nombre:
              </span>
              <div style={{ fontFamily: FONT, color: COLOR, fontSize: "9.5pt" }}>
                <p style={{ margin: 0 }}>{config.nombre_unidad_ejecutora}</p>
                <p style={{ margin: "1px 0 0 0" }}>{config.centro_costo_nombre}</p>
              </div>
            </div>

            {/* Dirección */}
            <div style={{ display: "flex" }}>
              <span style={{ fontWeight: "bold", whiteSpace: "nowrap", minWidth: "70px", fontFamily: FONT, color: COLOR, fontSize: "9.5pt" }}>
                Dirección:
              </span>
              <span style={{ fontFamily: FONT, color: COLOR, fontSize: "9.5pt" }}>{config.direccion_unidad}</span>
            </div>
          </div>

          {/* ── RECUADRO 3: Tabla ── */}
          <div style={{ border: B, borderRadius: RADIUS, overflow: "hidden", flex: 1, marginBottom: "6px", display: "flex", flexDirection: "column" }}>

            {/* Encabezado tabla — solo línea inferior, sin bordes entre columnas */}
            <div style={{ display: "flex", borderBottom: B, fontWeight: "bold", fontSize: "9pt", fontFamily: FONT, color: COLOR }}>
              <div style={{ width: "70px", padding: "4px 8px", textAlign: "center" }}>Código</div>
              <div style={{ flex: 1, padding: "4px 8px", textAlign: "center" }}>Descripción</div>
              <div style={{ width: "65px", padding: "4px 8px", textAlign: "center" }}>Cantidad</div>
            </div>

            {/* Filas de insumos — sin bordes internos */}
            <div style={{ flex: 1 }}>
              {items.map(item => (
                <div key={item.id} style={{ display: "flex", fontSize: "9pt", fontFamily: FONT, color: COLOR, minHeight: "22px", alignItems: "flex-start" }}>
                  <div style={{ width: "70px", padding: "3px 8px", textAlign: "center", fontFamily: "monospace" }}>
                    {item.codigo_igss ?? ""}
                  </div>
                  <div style={{ flex: 1, padding: "3px 8px", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 500, textTransform: "uppercase" }}>{item.nombre}</span>
                    <span style={{ fontSize: "8pt", color: "#555", whiteSpace: "nowrap", marginLeft: "8px" }}>
                      {item.codigo_ppr ?? ""}
                    </span>
                  </div>
                  <div style={{ width: "65px", padding: "3px 8px", textAlign: "center" }}>
                    {item.cantidad_solicitada.toLocaleString("es-GT")}
                  </div>
                </div>
              ))}
              {/* Filas vacías */}
              {Array.from({ length: emptyRows }).map((_, i) => (
                <div key={`e${i}`} style={{ display: "flex", minHeight: "22px" }}>
                  <div style={{ width: "70px" }}></div>
                  <div style={{ flex: 1 }}></div>
                  <div style={{ width: "65px" }}></div>
                </div>
              ))}
            </div>

            {/* Nota homologados */}
            <div style={{ borderTop: "1px solid #bbb", padding: "3px 8px", fontSize: "7pt", color: "#555", fontFamily: FONT }}>
              Los productos de los listados institucionales, se encuentran homologados con el catálogo general de insumos del SIGES, Presupuesto por Resultados (PpR)
            </div>

            {/* Resumen: solo encabezado + Total (sin filas de subproducto) */}
            <div style={{ borderTop: B }}>
              {/* Encabezado centrado */}
              <div style={{ display: "flex", borderBottom: "1px solid #bbb", fontWeight: "bold", fontSize: "9pt", fontFamily: FONT, color: COLOR }}>
                <div style={{ flex: 1, padding: "4px 8px", textAlign: "center", borderRight: B }}>
                  Código de Subproducto
                </div>
                <div style={{ width: "140px", padding: "4px 8px", textAlign: "center" }}>
                  Cantidad por Subproducto
                </div>
              </div>
              {/* Fila vacía de subproducto */}
              <div style={{ display: "flex", borderBottom: "1px solid #bbb", minHeight: "20px" }}>
                <div style={{ flex: 1, borderRight: B }}></div>
                <div style={{ width: "140px" }}></div>
              </div>
              {/* Total */}
              <div style={{ display: "flex", fontFamily: FONT, color: COLOR }}>
                <div style={{ flex: 1, padding: "4px 8px", textAlign: "right", fontWeight: "bold", fontSize: "9pt", borderRight: B }}>
                  Total
                </div>
                <div style={{ width: "140px", padding: "4px 8px", textAlign: "center", fontWeight: "bold", fontSize: "10pt" }}>
                  {totalGeneral.toLocaleString("es-GT")}
                </div>
              </div>
            </div>
          </div>

          {/* ── RECUADROS 4 y 5: Firmas ── */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "6px" }}>
            {[0, 1].map(idx => (
              <div key={idx} style={{ flex: 1, border: B, borderRadius: RADIUS, padding: "36px 16px 10px", textAlign: "center" }}>
                <div style={{ borderTop: "1.5px solid #333", paddingTop: "5px" }}>
                  <p style={{ margin: 0, fontWeight: "bold", fontSize: "9.5pt", textTransform: "uppercase", fontFamily: FONT, color: COLOR }}>
                    {firmantes[idx]?.nombre ?? ""}
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "9pt", fontFamily: FONT, color: COLOR }}>
                    {firmantes[idx]?.cargo ?? <span style={{ color: "#bbb" }}>Firmante {idx + 1}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ── RECUADRO 6: Justificación ── */}
          <div style={{ border: B, borderRadius: RADIUS, padding: "5px 12px", marginBottom: "5px", fontFamily: FONT, color: COLOR, fontSize: "9pt" }}>
            <strong>JUSTIFICACIÓN: </strong>
            <span style={{ textTransform: "uppercase" }}>{config.justificacion_siaf}</span>
          </div>

          {/* Pie */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8pt", color: "#555", fontFamily: FONT }}>
            <span>ID: {solicitud.id}</span>
            <span>Fecha de impresión: {new Date().toLocaleDateString("es-GT")}</span>
            <span>Hoja 1 de 1</span>
          </div>

        </div>{/* fin a4-sheet */}
      </div>{/* fin page-wrapper */}

      <style>{`
        /* ── Pantalla: centrar la hoja ── */
        .page-wrapper {
          margin-top: 60px;
          min-height: 100vh;
          background: #cbd5e1;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 32px 16px;
          box-sizing: border-box;
        }
        .a4-sheet {
          background: white;
          width: 210mm;
          min-height: 297mm;
          box-shadow: 0 4px 24px rgba(0,0,0,0.18);
          padding: 14mm 14mm 10mm 14mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }

        /* ── Impresión: exactamente A4, solo la hoja ── */
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          body * { visibility: hidden; }
          .a4-sheet, .a4-sheet * { visibility: visible; }
          .a4-sheet {
            position: fixed;
            top: 0; left: 0;
            width: 190mm;
            min-height: 0;
            height: 281mm;
            padding: 6mm 8mm;
            box-shadow: none;
            overflow: hidden;
          }
          .no-print, .page-wrapper { display: none !important; }
        }
      `}</style>
    </>
  );
}
