"use client";
import { useLayoutEffect, useRef, useState } from "react";

// Empaqueta "secciones" de contenido en hojas de tamaño real (Carta o A4) en
// vez de una sola caja que crece sin límite. Cada sección se mide una vez
// (oculta) contra el alto disponible de una hoja y se van acomodando de
// forma continua: si la siguiente no cabe en la hoja actual, arranca una
// hoja nueva — nunca corta una sección a la mitad. Usado por toda pantalla
// de impresión con contenido de largo variable (tablas de insumos,
// listados, texto libre) en vez de un formulario de overlay de tamaño fijo.
export type PageSize = "letter" | "a4";
const SIZES: Record<PageSize, { width: number; height: number }> = {
  letter: { width: 215.9, height: 279.4 },
  a4: { width: 210, height: 297 },
};
const MM_TO_PX = 96 / 25.4;
// Referencia estable: un `= []` inline como default de parámetro se recrea en
// cada invocación del componente (incluso en renders propios sin cambios del
// padre), lo que rompe las deps del useLayoutEffect de abajo y provoca un
// loop infinito de setState (React #185) en callers que omiten headerSections.
const NO_HEADER_SECTIONS: React.ReactNode[] = [];

interface Props {
  sections: React.ReactNode[];
  // Se repite intacto al inicio de cada hoja (ej. encabezado de tabla) — no
  // cuenta como una sección paginable, resta de su alto disponible.
  headerSections?: React.ReactNode[];
  pageSize?: PageSize;
  landscape?: boolean;
  marginMm?: number;
  onPageCount?: (n: number) => void;
}

export default function PrintPages({ sections, headerSections = NO_HEADER_SECTIONS, pageSize = "letter", landscape = false, marginMm = 12, onPageCount }: Props) {
  const base = SIZES[pageSize];
  const widthMm = landscape ? base.height : base.width;
  const heightMm = landscape ? base.width : base.height;
  const contentWidthMm = widthMm - marginMm * 2;
  const pageContentHeightPx = (heightMm - marginMm * 2) * MM_TO_PX;

  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [pages, setPages] = useState<number[][] | null>(null);

  useLayoutEffect(() => {
    const headerHeight = headerRefs.current.slice(0, headerSections.length).reduce((s, el) => s + (el?.scrollHeight ?? 0), 0);
    const contentHeightPx = pageContentHeightPx - headerHeight;
    const heights = sectionRefs.current.slice(0, sections.length).map(el => el?.scrollHeight ?? 0);
    const result: number[][] = [];
    let current: number[] = [];
    let currentHeight = 0;
    heights.forEach((h, i) => {
      if (current.length > 0 && currentHeight + h > contentHeightPx) {
        result.push(current);
        current = [];
        currentHeight = 0;
      }
      current.push(i);
      currentHeight += h;
    });
    if (current.length > 0) result.push(current);
    setPages(result);
    onPageCount?.(result.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, headerSections, pageContentHeightPx]);

  return (
    <>
      {/* Medidor invisible: cada sección (y el encabezado repetido) se mide
          por separado, sin cortar, para decidir cuántas hojas hacen falta
          antes de renderizar. */}
      <div style={{ position: "absolute", top: 0, left: "-9999px", width: `${contentWidthMm}mm`, visibility: "hidden" }}>
        {headerSections.map((s, i) => (
          <div key={`h${i}`} ref={el => { headerRefs.current[i] = el; }}>{s}</div>
        ))}
        {sections.map((s, i) => (
          <div key={i} ref={el => { sectionRefs.current[i] = el; }}>{s}</div>
        ))}
      </div>

      <div id="print-pages-wrapper">
        {pages?.map((group, pageIdx) => (
          <div className="print-page" key={pageIdx}>
            {headerSections.map((s, i) => <div key={`h${i}`}>{s}</div>)}
            {group.map(i => <div key={i}>{sections[i]}</div>)}
          </div>
        ))}
      </div>

      <style>{`
        #print-pages-wrapper {
          background: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 24px;
          padding: 40px 20px; min-height: 100vh; margin-top: 52px; box-sizing: border-box;
        }
        .print-page {
          background: white; width: ${widthMm}mm; min-height: ${heightMm}mm;
          box-shadow: 0 4px 32px rgba(0,0,0,0.22);
          padding: ${marginMm}mm; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; color: #000;
        }
        @media print {
          @page { size: ${pageSize}${landscape ? " landscape" : " portrait"}; margin: ${marginMm}mm; }
          #print-pages-wrapper { background: white !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; gap: 0 !important; display: block !important; }
          .print-page { width: 100% !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; page-break-after: always; }
          .print-page:last-child { page-break-after: auto; }
        }
      `}</style>
    </>
  );
}
