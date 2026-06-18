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

export default function ImprimirClient({
  solicitud, items, config, todosFirmantes, firmantesSeleccionados: initFirmantes,
}: Props) {
  const router = useRouter();
  const [firmantes, setFirmantes] = useState<Firmante[]>(initFirmantes);
  const [showSelector, setShowSelector] = useState(initFirmantes.length === 0);
  const [slot, setSlot] = useState<0 | 1>(0);

  function pickFirmante(idx: 0 | 1, firmante: Firmante) {
    setFirmantes(p => { const next = [...p]; next[idx] = firmante; return next; });
  }

  const corrLabel = `${solicitud.numero}/${solicitud.anio}`;

  // Totales por subproducto
  const subproductoMap = new Map<string, number>();
  items.forEach(i => {
    subproductoMap.set(i.subproducto, (subproductoMap.get(i.subproducto) ?? 0) + i.cantidad_solicitada);
  });
  const totalGeneral = items.reduce((s, i) => s + i.cantidad_solicitada, 0);

  // Filas vacías para completar espacio mínimo
  const MIN_ROWS = 8;
  const emptyRows = Math.max(0, MIN_ROWS - items.length);

  return (
    <>
      {/* ── Barra de controles (no se imprime) ── */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
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
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50 transition-colors max-w-[220px]">
              <span className="truncate text-left">
                {firmantes[idx]
                  ? <span><strong>{firmantes[idx].nombre}</strong> — {firmantes[idx].cargo}</span>
                  : <span className="text-gray-400">Firmante {idx + 1}…</span>}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
            </button>
          ))}
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      {/* Selector de firmante */}
      {showSelector && (
        <div className="print:hidden fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="font-semibold text-sm">Selecciona firmante {slot + 1}</p>
              <button onClick={() => setShowSelector(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="py-2 max-h-64 overflow-y-auto">
              {todosFirmantes.map(f => (
                <button key={f.id}
                  onMouseDown={() => { pickFirmante(slot, f); setShowSelector(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors">
                  <p className="text-sm font-medium text-gray-900">{f.nombre}</p>
                  <p className="text-xs text-gray-500">{f.cargo}</p>
                </button>
              ))}
              {todosFirmantes.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">
                  No hay firmantes. El superadmin debe agregarlos en Configuración.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── FORMULARIO IMPRIMIBLE ── */}
      <div className="print:mt-0 mt-20 min-h-screen bg-gray-200 print:bg-white flex justify-center py-10 print:py-0">
        <div style={{ width: "210mm", minHeight: "297mm", fontFamily: "Arial, sans-serif", fontSize: "10pt" }}
          className="bg-white shadow-2xl print:shadow-none px-7 py-5 print:px-5 print:py-4 flex flex-col gap-2.5">

          {/* ══ RECUADRO 1: Header ══ */}
          <div style={{ border: "1.5px solid #333", borderRadius: "8px", display: "flex", alignItems: "stretch", minHeight: "64px" }}>

            {/* Logo */}
            <div style={{ borderRight: "1px solid #aaa", padding: "6px 10px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: "110px" }}>
              {/* Si hay logo en /logo-igss.png úsalo, sino muestra placeholder */}
              <img src="/logo-igss.png" alt="IGSS"
                style={{ width: "38px", height: "38px", objectFit: "contain" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).nextElementSibling?.removeAttribute("style");
                }} />
              {/* Fallback text logo */}
              <span style={{ display: "none", fontSize: "6pt", textAlign: "center", color: "#1a3a6b", fontWeight: "bold", lineHeight: "1.2" }}>
                Instituto<br />Guatemalteco de<br />Seguridad Social
              </span>
              <p style={{ fontSize: "5pt", textAlign: "center", color: "#1a3a6b", marginTop: "2px", lineHeight: "1.2" }}>
                Instituto Guatemalteco de<br />Seguridad Social
              </p>
            </div>

            {/* Títulos */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: "16px" }}>
              <p style={{ fontWeight: "bold", fontSize: "13pt", textAlign: "right", paddingRight: "12px", marginBottom: "2px" }}>
                FORMA A-01 SIAF
              </p>
              <p style={{ fontWeight: "bold", fontSize: "12pt", textAlign: "center" }}>
                SOLICITUD DE COMPRA DE BIENES Y/O SERVICIOS
              </p>
            </div>
          </div>

          {/* ══ RECUADRO 2: Datos de registro ══ */}
          <div style={{ border: "1.5px solid #333", borderRadius: "8px", padding: "8px 12px" }}>
            {/* Fecha + Correlativo */}
            <div style={{ display: "flex", gap: "60px", marginBottom: "6px" }}>
              <p style={{ margin: 0 }}>
                <span style={{ fontWeight: "bold" }}>Fecha de Registro</span>
                &nbsp;&nbsp;&nbsp;&nbsp;{solicitud.fecha}
              </p>
              <p style={{ margin: 0 }}>
                <span style={{ fontWeight: "bold" }}>Correlativo No.</span>
                &nbsp;&nbsp;&nbsp;&nbsp;
                <strong style={{ fontSize: "11pt" }}>{corrLabel}</strong>
              </p>
            </div>

            {/* Datos unidad */}
            <p style={{ fontWeight: "bold", fontSize: "9pt", margin: "0 0 4px 0" }}>
              DATOS DE LA UNIDAD EJECUTORA, CENTRO COSTO, DEPENDENCIA o SERVICIO
            </p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "3px" }}>
              <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>Nombre:</span>
              <div style={{ fontSize: "9.5pt" }}>
                <p style={{ margin: 0 }}>{config.nombre_unidad_ejecutora}</p>
                <p style={{ margin: "1px 0 0 0" }}>{config.centro_costo_nombre}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>Dirección:</span>
              <span style={{ fontSize: "9.5pt" }}>{config.direccion_unidad}</span>
            </div>
          </div>

          {/* ══ RECUADRO 3: Tabla de insumos ══ */}
          <div style={{ border: "1.5px solid #333", borderRadius: "8px", overflow: "hidden", flex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
              <colgroup>
                <col style={{ width: "60px" }} />
                <col style={{ width: "auto" }} />
                <col style={{ width: "90px" }} />
                <col style={{ width: "60px" }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: "1.5px solid #333" }}>
                  <th style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #999", fontWeight: "bold" }}>
                    Código
                  </th>
                  <th style={{ padding: "4px 8px", textAlign: "center", fontWeight: "bold" }} colSpan={2}>
                    Descripción
                  </th>
                  <th style={{ padding: "4px 8px", textAlign: "center", borderLeft: "1px solid #999", fontWeight: "bold" }}>
                    Cantidad
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "0.5px solid #ddd" }}>
                    <td style={{ padding: "3px 8px", textAlign: "center", borderRight: "1px solid #999", verticalAlign: "top", fontFamily: "monospace" }}>
                      {item.codigo_igss ?? ""}
                    </td>
                    <td style={{ padding: "3px 8px", verticalAlign: "top", fontWeight: "500", textTransform: "uppercase" }}>
                      {item.nombre}
                    </td>
                    {/* Col subproducto — sin borde superior (por eso colSpan en el header), visible en body */}
                    <td style={{ padding: "3px 8px", verticalAlign: "top", fontSize: "8pt", color: "#555", textAlign: "right", whiteSpace: "nowrap" }}>
                      {item.codigo_ppr ?? item.subproducto}
                    </td>
                    <td style={{ padding: "3px 8px", textAlign: "center", borderLeft: "1px solid #999", verticalAlign: "top" }}>
                      {item.cantidad_solicitada.toLocaleString("es-GT")}
                    </td>
                  </tr>
                ))}
                {/* Filas vacías */}
                {Array.from({ length: emptyRows }).map((_, i) => (
                  <tr key={`e${i}`} style={{ borderBottom: "0.5px solid #ddd", height: "22px" }}>
                    <td style={{ borderRight: "1px solid #999" }}></td>
                    <td></td>
                    <td></td>
                    <td style={{ borderLeft: "1px solid #999" }}></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Nota al pie de tabla */}
            <div style={{ borderTop: "0.5px solid #bbb", padding: "4px 8px 2px 8px", fontSize: "7.5pt", color: "#444" }}>
              Los productos de los listados institucionales, se encuentran homologados con el catálogo general de insumos del SIGES, Presupuesto por Resultados (PpR)
            </div>

            {/* Resumen por subproducto */}
            <div style={{ borderTop: "1.5px solid #333" }}>
              {/* Encabezado */}
              <div style={{ display: "flex", borderBottom: "0.5px solid #bbb" }}>
                <div style={{ flex: 1, padding: "4px 8px", fontWeight: "bold", textAlign: "center", fontSize: "9pt", borderRight: "1.5px solid #333" }}>
                  Código de Subproducto
                </div>
                <div style={{ width: "60px", padding: "4px 8px", fontWeight: "bold", textAlign: "center", fontSize: "9pt" }}>
                  Cantidad por Subproducto
                </div>
              </div>
              {/* Filas por subproducto */}
              {Array.from(subproductoMap.entries()).map(([sub, qty], i) => (
                <div key={i} style={{ display: "flex", borderBottom: "0.5px solid #bbb" }}>
                  <div style={{ flex: 1, padding: "3px 8px", fontFamily: "monospace", fontSize: "9pt", borderRight: "1.5px solid #333" }}>
                    {sub}
                  </div>
                  <div style={{ width: "60px", padding: "3px 8px", textAlign: "center", fontWeight: "600", fontSize: "9pt" }}>
                    {qty.toLocaleString("es-GT")}
                  </div>
                </div>
              ))}
              {/* Total */}
              <div style={{ display: "flex" }}>
                <div style={{ flex: 1, padding: "3px 8px", fontWeight: "bold", textAlign: "right", fontSize: "9pt", borderRight: "1.5px solid #333" }}>
                  Total
                </div>
                <div style={{ width: "60px", padding: "3px 8px", textAlign: "center", fontWeight: "bold", fontSize: "10pt" }}>
                  {totalGeneral.toLocaleString("es-GT")}
                </div>
              </div>
            </div>
          </div>

          {/* ══ RECUADROS 4 y 5: Firmas ══ */}
          <div style={{ display: "flex", gap: "12px" }}>
            {[0, 1].map(idx => (
              <div key={idx} style={{
                flex: 1, border: "1.5px solid #333", borderRadius: "8px",
                padding: "40px 16px 10px 16px", textAlign: "center",
              }}>
                <div style={{ borderTop: "1px solid #333", paddingTop: "6px" }}>
                  <p style={{ margin: 0, fontWeight: "bold", fontSize: "9.5pt", textTransform: "uppercase" }}>
                    {firmantes[idx]?.nombre ?? ""}
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "9pt" }}>
                    {firmantes[idx]?.cargo ?? <span style={{ color: "#ccc" }}>Firmante {idx + 1}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ══ RECUADRO 6: Justificación ══ */}
          <div style={{ border: "1.5px solid #333", borderRadius: "8px", padding: "6px 12px", fontSize: "9pt" }}>
            <span style={{ fontWeight: "bold" }}>JUSTIFICACIÓN: </span>
            <span style={{ textTransform: "uppercase" }}>{config.justificacion_siaf}</span>
          </div>

          {/* Pie de página */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8pt", color: "#666", paddingTop: "2px" }}>
            <span>ID: {solicitud.id}</span>
            <span>Fecha de impresión: {new Date().toLocaleDateString("es-GT")}</span>
            <span>Hoja 1 de 1</span>
          </div>

        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  );
}
