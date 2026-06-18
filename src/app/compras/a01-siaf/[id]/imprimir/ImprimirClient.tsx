"use client";
import { useState, useRef } from "react";
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
  const [slot, setSlot] = useState<0 | 1>(0); // qué slot estamos llenando

  // Selector de firmante para un slot
  function pickFirmante(idx: 0 | 1, firmante: Firmante) {
    setFirmantes(p => {
      const next = [...p];
      next[idx] = firmante;
      return next;
    });
  }

  function handlePrint() {
    window.print();
  }

  const corrLabel = `${solicitud.numero}/${solicitud.anio}`;
  const fechaLabel = solicitud.fecha;

  // Agrupar ítems por subproducto para la fila de totales
  const subproductoMap = new Map<string, number>();
  items.forEach(i => {
    subproductoMap.set(i.subproducto, (subproductoMap.get(i.subproducto) ?? 0) + i.cantidad_solicitada);
  });

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

        {/* Selector firmantes */}
        <div className="flex items-center gap-3 ml-auto">
          {[0, 1].map(idx => (
            <div key={idx} className="relative">
              <button
                onClick={() => { setSlot(idx as 0 | 1); setShowSelector(true); }}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50 transition-colors max-w-[200px]">
                <span className="truncate text-left">
                  {firmantes[idx]
                    ? <><strong>{firmantes[idx].nombre}</strong><br />{firmantes[idx].cargo}</>
                    : <span className="text-gray-400">Firmante {idx + 1}…</span>}
                </span>
                <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
              </button>
            </div>
          ))}
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      {/* Dropdown selector de firmante */}
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
                  onClick={() => { pickFirmante(slot, f); setShowSelector(false); }}
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

      {/* ── Formulario imprimible ── */}
      <div className="print:mt-0 mt-20 min-h-screen bg-gray-100 print:bg-white flex justify-center py-8 print:py-0">
        <div className="
          bg-white w-[210mm] min-h-[297mm]
          print:w-full print:min-h-0 print:shadow-none
          shadow-xl px-8 py-6 print:px-6 print:py-4
          font-sans text-[11px] text-gray-900
          flex flex-col gap-3
        ">

          {/* ── RECUADRO 1: Logo + Título ── */}
          <div className="border-2 border-gray-800 rounded-xl flex items-stretch min-h-[70px]">
            {/* Logo izq */}
            <div className="flex items-center justify-center px-4 border-r-2 border-gray-800 min-w-[80px]">
              {/* SVG del escudo IGSS simplificado */}
              <svg width="54" height="54" viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="52" height="52" rx="6" fill="white" stroke="#1a3a6b" strokeWidth="2"/>
                <text x="27" y="20" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#1a3a6b">Instituto</text>
                <text x="27" y="28" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="#1a3a6b">Guatemalteco de</text>
                <text x="27" y="36" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#1a3a6b">Seguridad</text>
                <text x="27" y="44" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#1a3a6b">Social</text>
                <rect x="4" y="4" width="46" height="46" rx="4" fill="none" stroke="#1a3a6b" strokeWidth="1"/>
              </svg>
            </div>
            {/* Título */}
            <div className="flex flex-col justify-center items-center flex-1 px-4 text-center">
              <p className="font-bold text-[13px] tracking-wide">FORMA A-01 SIAF</p>
              <p className="font-bold text-[12px] tracking-wide mt-0.5">SOLICITUD DE COMPRA DE BIENES Y/O SERVICIOS</p>
            </div>
          </div>

          {/* ── RECUADRO 2: Datos de registro ── */}
          <div className="border-2 border-gray-800 rounded-xl p-3 space-y-1.5">
            <div className="flex gap-8">
              <p><span className="font-semibold">Fecha de Registro</span>&nbsp;&nbsp;{fechaLabel}</p>
              <p><span className="font-semibold">Correlativo No.</span>&nbsp;&nbsp;
                <span className="font-bold text-[12px]">{corrLabel}</span>
              </p>
            </div>
            <p className="font-bold text-[10.5px]">DATOS DE LA UNIDAD EJECUTORA, CENTRO COSTO, DEPENDENCIA O SERVICIO</p>
            <div className="flex gap-2">
              <p className="font-semibold whitespace-nowrap">Nombre:</p>
              <div>
                <p>{config.nombre_unidad_ejecutora}</p>
                <p className="mt-0.5">{config.centro_costo_nombre}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <p className="font-semibold whitespace-nowrap">Dirección:</p>
              <p>{config.direccion_unidad}</p>
            </div>
          </div>

          {/* ── RECUADRO 3: Tabla de insumos ── */}
          <div className="border-2 border-gray-800 rounded-xl overflow-hidden flex-1">
            <table className="w-full text-[10.5px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #1f2937" }}>
                  <th className="px-3 py-2 text-center font-bold border-r-2 border-gray-800 w-[80px]">Código</th>
                  <th className="px-3 py-2 text-left font-bold border-r border-gray-300">Descripción</th>
                  {/* col subproducto sin título ni borde visible */}
                  <th className="px-3 py-2 text-center font-bold border-l border-gray-300 w-[90px]">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #d1d5db" }}>
                    <td className="px-3 py-1.5 text-center border-r-2 border-gray-800 font-mono">
                      {item.codigo_igss ?? "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="font-medium uppercase">{item.nombre}</span>
                    </td>
                    <td className="px-3 py-1.5 text-[9px] text-gray-500 border-l border-gray-300 text-center whitespace-nowrap">
                      {item.codigo_ppr ?? item.subproducto}
                    </td>
                    <td className="hidden">
                      {/* La columna de cantidad se muestra abajo en el bloque de subproducto/total */}
                    </td>
                  </tr>
                ))}
                {/* Espacio en blanco para que el formulario tenga cuerpo */}
                {items.length < 6 && Array.from({ length: 6 - items.length }).map((_, i) => (
                  <tr key={`empty-${i}`} style={{ borderBottom: "1px solid #d1d5db", height: "28px" }}>
                    <td className="border-r-2 border-gray-800"></td>
                    <td></td>
                    <td className="border-l border-gray-300"></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pie de tabla: subproducto + cantidades */}
            <div style={{ borderTop: "2px solid #1f2937" }}>
              {/* Nota pie */}
              <div className="px-3 py-1.5 border-b border-gray-300 text-[9px] text-gray-600">
                Los productos de los listados institucionales, se encuentran homologados con el catálogo general de insumos del SIGES, Presupuesto por Resultados (PpR)
              </div>
              {/* Encabezado subproducto / cantidad */}
              <div className="flex" style={{ borderBottom: "1px solid #d1d5db" }}>
                <div className="flex-1 px-3 py-1.5 font-bold text-center border-r-2 border-gray-800 text-[10px]">
                  Código de Subproducto
                </div>
                <div className="px-3 py-1.5 font-bold text-center w-[90px] text-[10px]">
                  Cantidad por Subproducto
                </div>
              </div>
              {/* Filas por subproducto */}
              {Array.from(subproductoMap.entries()).map(([sub, qty], i) => (
                <div key={i} className="flex" style={{ borderBottom: "1px solid #d1d5db" }}>
                  <div className="flex-1 px-3 py-1.5 border-r-2 border-gray-800 font-mono text-[10px]">{sub}</div>
                  <div className="px-3 py-1.5 text-center w-[90px] font-semibold text-[10px]">
                    {qty.toLocaleString("es-GT")}
                  </div>
                </div>
              ))}
              {/* Total */}
              <div className="flex">
                <div className="flex-1 px-3 py-1.5 font-bold text-right border-r-2 border-gray-800 text-[10px]">Total</div>
                <div className="px-3 py-1.5 text-center w-[90px] font-bold text-[11px]">
                  {items.reduce((s, i) => s + i.cantidad_solicitada, 0).toLocaleString("es-GT")}
                </div>
              </div>
            </div>
          </div>

          {/* ── RECUADROS 4 y 5: Firmas ── */}
          <div className="flex gap-3">
            {[0, 1].map(idx => (
              <div key={idx} className="flex-1 border-2 border-gray-800 rounded-xl px-4 pt-10 pb-3 text-center min-h-[90px] flex flex-col justify-end">
                <div style={{ borderTop: "1px solid #374151" }} className="pt-1.5">
                  <p className="font-bold text-[10.5px] uppercase">
                    {firmantes[idx]?.nombre ?? <span className="text-gray-400 print:text-gray-300">─ Firmante {idx + 1} ─</span>}
                  </p>
                  <p className="text-[9.5px] text-gray-600 mt-0.5">
                    {firmantes[idx]?.cargo ?? ""}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ── RECUADRO 6: Justificación ── */}
          <div className="border-2 border-gray-800 rounded-xl px-4 py-3">
            <span className="font-bold text-[10.5px]">JUSTIFICACIÓN: </span>
            <span className="text-[10.5px] uppercase">{config.justificacion_siaf}</span>
          </div>

          {/* Pie de página */}
          <div className="flex justify-between text-[9px] text-gray-500 pt-1">
            <span>ID: {solicitud.id}</span>
            <span>Fecha de impresión: {new Date().toLocaleDateString("es-GT")}</span>
            <span>Hoja 1 de 1</span>
          </div>
        </div>
      </div>

      {/* Estilos de impresión */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  );
}
