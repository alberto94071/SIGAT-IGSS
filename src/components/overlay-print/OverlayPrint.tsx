"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, RotateCcw } from "lucide-react";

// Formularios pre-impresos de Guatemala (DAB-75, Planilla de Viático, etc.): el papel
// ya trae todas las líneas y casillas de fábrica. Aquí solo se posiciona el texto en
// las casillas — nunca se dibujan líneas, bordes ni fondos, porque eso ya está en el
// papel. El ajuste en milímetros compensa la variación de registro entre impresoras.
type Offset = { x: number; y: number };

const OffsetCtx = createContext<Offset>({ x: 0, y: 0 });
export function useOverlayOffset() {
  return useContext(OffsetCtx);
}

interface OverlayPrintProps {
  storageKey: string;
  title: string;
  pageWidthIn?: number;
  pageHeightIn?: number;
  children: ReactNode;
}

export function OverlayPrint({ storageKey, title, pageWidthIn = 8.5, pageHeightIn = 11, children }: OverlayPrintProps) {
  const router = useRouter();
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try { setOffset(JSON.parse(raw)); } catch { /* ignora ajuste corrupto */ }
    }
    setLoaded(true);
  }, [storageKey]);

  function update(next: Offset) {
    setOffset(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  const mmX = Math.round(offset.x * 25.4 * 10) / 10;
  const mmY = Math.round(offset.y * 25.4 * 10) / 10;

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex flex-wrap items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">{title}</span>

        <label className="flex items-center gap-1.5 text-xs text-gray-600 ml-4">
          Ajuste horizontal (mm)
          <input type="number" step="0.5" value={mmX}
            onChange={e => update({ ...offset, x: Number(e.target.value) / 25.4 })}
            className="w-16 input py-1 text-xs" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          Ajuste vertical (mm)
          <input type="number" step="0.5" value={mmY}
            onChange={e => update({ ...offset, y: Number(e.target.value) / 25.4 })}
            className="w-16 input py-1 text-xs" />
        </label>
        <button onClick={() => update({ x: 0, y: 0 })}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          <RotateCcw className="w-3 h-3" /> Reiniciar
        </button>

        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>

        <p className="w-full text-xs text-gray-500">
          Cargue en la impresora la hoja ya impresa de fábrica antes de imprimir. Solo se
          imprimen los datos — ninguna línea ni casilla. Si el texto no cae exactamente en
          su lugar, corrija los milímetros de arriba: el ajuste se recuerda para la próxima vez.
        </p>
      </div>

      <div id="overlay-print-wrapper">
        <div id="overlay-page" style={{ width: `${pageWidthIn}in`, height: `${pageHeightIn}in` }}>
          {loaded && <OffsetCtx.Provider value={offset}>{children}</OffsetCtx.Provider>}
        </div>
      </div>

      <style>{`
        #overlay-print-wrapper {
          background: #94a3b8; display: flex; justify-content: center; align-items: flex-start;
          padding: 40px 20px; min-height: 100vh; margin-top: 68px; box-sizing: border-box;
        }
        #overlay-page {
          position: relative; background: white; box-shadow: 0 4px 32px rgba(0,0,0,0.22);
          box-sizing: border-box; flex-shrink: 0;
        }
        .no-print { display: block; }
        @media print {
          @page { size: letter; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          #overlay-print-wrapper {
            background: white !important; padding: 0 !important; margin: 0 !important;
            min-height: 0 !important; display: block !important;
          }
          #overlay-page { box-shadow: none !important; }
        }
      `}</style>
    </>
  );
}
