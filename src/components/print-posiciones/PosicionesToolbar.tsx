"use client";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft, Eye, EyeOff, Save, RotateCcw } from "lucide-react";

export function PosicionesToolbar({
  titulo, verPosiciones, onToggleVer, onRestablecer, onGuardar, guardando, guardado,
}: {
  titulo: string; verPosiciones: boolean; onToggleVer: () => void;
  onRestablecer: () => void; onGuardar: () => void; guardando: boolean; guardado: boolean;
}) {
  const router = useRouter();
  return (
    <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>
      <span className="text-gray-300">|</span>
      <span className="text-sm font-semibold text-gray-700">{titulo}</span>
      {verPosiciones && (
        <span className="text-xs text-gray-400">
          Arrastrá el punto azul para mover, el verde para cambiar tamaño, y hacé clic sobre el texto para editarlo.
        </span>
      )}
      <div className="flex items-center gap-3 ml-auto">
        {verPosiciones && (
          <>
            <button onClick={onRestablecer}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50">
              <RotateCcw className="w-3.5 h-3.5" /> Restablecer
            </button>
            <button onClick={onGuardar} disabled={guardando}
              className="flex items-center gap-2 px-3 py-1.5 border border-brand-200 bg-brand-50 text-brand-700 rounded-lg text-xs hover:bg-brand-100 disabled:opacity-60">
              <Save className="w-3.5 h-3.5" /> {guardando ? "Guardando…" : guardado ? "Guardado ✓" : "Guardar posiciones"}
            </button>
          </>
        )}
        <button onClick={onToggleVer}
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
  );
}

// Hoja carta (215.9 x 279.4mm) con el fondo de referencia opcional — se ve
// siempre en pantalla para previsualizar cómo va a quedar el documento real
// (opacidad baja), pero se oculta al imprimir (.no-print): en el papel solo
// salen los datos, nunca la foto — el formulario ya viene impreso de fábrica.
export function HojaConFondo({
  hojaRef, fondo, children,
}: {
  hojaRef: React.RefObject<HTMLDivElement | null>; fondo: string | null; children: React.ReactNode;
}) {
  return (
    <div id="print-wrapper">
      <div id="hoja-pos" ref={hojaRef}>
        {fondo && (
          <img src={fondo} alt="" className="no-print" style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "fill", opacity: 0.55, pointerEvents: "none",
          }} />
        )}
        {children}
      </div>
    </div>
  );
}

export const HOJA_CON_FONDO_CSS = `
  #print-wrapper {
    background: #94a3b8; display: flex; justify-content: center; align-items: flex-start;
    padding: 40px 20px; min-height: 100vh; margin-top: 52px; box-sizing: border-box;
  }
  #hoja-pos {
    position: relative; background: white; width: 215.9mm; height: 279.4mm;
    box-shadow: 0 4px 32px rgba(0,0,0,0.22); box-sizing: border-box; overflow: hidden;
  }
  .no-print { display: block; }
  @media print {
    @page { size: letter portrait; margin: 0; }
    .no-print { display: none !important; }
    #print-wrapper { background: white !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; display: block !important; }
    #hoja-pos { width: 100% !important; height: 100vh !important; box-shadow: none !important; }
  }
`;
