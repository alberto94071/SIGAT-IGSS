"use client";
import { useRef, useLayoutEffect, useCallback, type RefObject } from "react";

// Motor genérico de "campo arrastrable/redimensionable sobre una hoja" — la
// misma lógica que usa el DAB-60 (ver ImprimirDab60Client.tsx), extraída acá
// para reutilizarla en otros formularios pre-impresos (Vale de Caja Chica,
// Cheque) sin duplicar el código de arrastrar/redimensionar/autoajustar letra
// tres veces. El DAB-60 se deja tal cual (ya probado en producción) — este
// módulo es solo para los formularios nuevos.

export type Pos = { top: number; left: number; width?: number; height?: number };

const MIN_W_MM = 8;
const MIN_H_MM = 4;
const DEFAULT_FONT_PT = 9;
const MIN_FONT_PT = 4;

export function useDrag(
  hojaRef: RefObject<HTMLDivElement | null>, hojaWMm: number, hojaHMm: number,
  id: string, pos: Pos, onChange: (id: string, pos: Pos) => void, enabled: boolean,
) {
  const draggingRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number; mmPerPxX: number; mmPerPxY: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    e.preventDefault(); e.stopPropagation();
    const rect = hojaRef.current?.getBoundingClientRect();
    if (!rect) return;
    draggingRef.current = {
      startX: e.clientX, startY: e.clientY, startTop: pos.top, startLeft: pos.left,
      mmPerPxX: hojaWMm / rect.width, mmPerPxY: hojaHMm / rect.height,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [enabled, hojaRef, hojaWMm, hojaHMm, pos.top, pos.left]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = draggingRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) * d.mmPerPxX;
    const dy = (e.clientY - d.startY) * d.mmPerPxY;
    onChange(id, { ...pos, top: Math.max(0, d.startTop + dy), left: Math.max(0, d.startLeft + dx) });
  }, [id, onChange, pos]);

  const onPointerUp = useCallback(() => { draggingRef.current = null; }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}

function useResize(
  hojaRef: RefObject<HTMLDivElement | null>, hojaWMm: number, hojaHMm: number,
  fieldRef: RefObject<HTMLDivElement | null>,
  id: string, pos: Pos, onChange: (id: string, pos: Pos) => void, enabled: boolean,
) {
  const resizingRef = useRef<{ startX: number; startY: number; startW: number; startH: number; mmPerPxX: number; mmPerPxY: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    e.preventDefault(); e.stopPropagation();
    const hojaRect = hojaRef.current?.getBoundingClientRect();
    const fieldRect = fieldRef.current?.getBoundingClientRect();
    if (!hojaRect || !fieldRect) return;
    const mmPerPxX = hojaWMm / hojaRect.width;
    const mmPerPxY = hojaHMm / hojaRect.height;
    resizingRef.current = {
      startX: e.clientX, startY: e.clientY,
      startW: pos.width ?? fieldRect.width * mmPerPxX,
      startH: pos.height ?? fieldRect.height * mmPerPxY,
      mmPerPxX, mmPerPxY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [enabled, hojaRef, hojaWMm, hojaHMm, fieldRef, pos.width, pos.height]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const r = resizingRef.current;
    if (!r) return;
    const dx = (e.clientX - r.startX) * r.mmPerPxX;
    const dy = (e.clientY - r.startY) * r.mmPerPxY;
    onChange(id, { ...pos, width: Math.max(MIN_W_MM, r.startW + dx), height: Math.max(MIN_H_MM, r.startH + dy) });
  }, [id, onChange, pos]);

  const onPointerUp = useCallback(() => { resizingRef.current = null; }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}

function useAutoFit(ref: RefObject<HTMLElement | null>, active: boolean, ...deps: unknown[]) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!active) { el.style.fontSize = ""; return; }
    let size = DEFAULT_FONT_PT;
    el.style.fontSize = `${size}pt`;
    while (size > MIN_FONT_PT && (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)) {
      size -= 0.25;
      el.style.fontSize = `${size}pt`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);
}

type Handlers = { onPointerDown: (e: React.PointerEvent) => void; onPointerMove: (e: React.PointerEvent) => void; onPointerUp: () => void };

function DragHandle({ handlers, label }: { handlers: Handlers; label?: string }) {
  return (
    <div
      className="cpos-handle cpos-handle-move no-print" contentEditable={false}
      title={label ? `Mover — ${label}` : "Mover"}
      onPointerDown={handlers.onPointerDown} onPointerMove={handlers.onPointerMove} onPointerUp={handlers.onPointerUp}
    />
  );
}

function ResizeHandle({ handlers, label }: { handlers: Handlers; label?: string }) {
  return (
    <div
      className="cpos-handle cpos-handle-resize no-print" contentEditable={false}
      title={label ? `Cambiar tamaño — ${label}` : "Cambiar tamaño"}
      onPointerDown={handlers.onPointerDown} onPointerMove={handlers.onPointerMove} onPointerUp={handlers.onPointerUp}
    />
  );
}

export function Campo({
  id, texto, hojaRef, hojaWMm, hojaHMm, pos, onChange, editable, style, label, onTextChange, multiline = false, font = "Arial, Helvetica, sans-serif",
}: {
  id: string; texto: string; hojaRef: RefObject<HTMLDivElement | null>; hojaWMm: number; hojaHMm: number; pos: Pos;
  onChange: (id: string, pos: Pos) => void; editable: boolean; style?: React.CSSProperties;
  label?: string; onTextChange?: (id: string, texto: string) => void; multiline?: boolean; font?: string;
}) {
  // El wrapper externo (outerRef) define posición y tamaño y aloja las
  // manijas de mover/redimensionar sin recortarlas; el recorte (overflow
  // hidden) y el autoajuste de letra van en el div interno, para que las
  // manijas —que sobresalen un poco del borde— sigan siendo clickeables
  // aunque el campo ya tenga un tamaño fijo.
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const drag = useDrag(hojaRef, hojaWMm, hojaHMm, id, pos, onChange, editable);
  const resize = useResize(hojaRef, hojaWMm, hojaHMm, outerRef, id, pos, onChange, editable);
  const sized = pos.width != null && pos.height != null;
  useAutoFit(innerRef, sized, texto, pos.width, pos.height);

  const contenido = editable && !texto ? `⟨${id}⟩` : texto;

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    onTextChange?.(id, e.currentTarget.textContent ?? "");
  }, [id, onTextChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!multiline && e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
  }, [multiline]);

  return (
    <div
      ref={outerRef}
      className="cpos-campo"
      title={editable ? label : undefined}
      style={{
        position: "absolute", top: `${pos.top}mm`, left: `${pos.left}mm`,
        width: sized ? `${pos.width}mm` : undefined, height: sized ? `${pos.height}mm` : undefined,
      }}
    >
      <div
        ref={innerRef}
        contentEditable={editable}
        suppressContentEditableWarning
        onBlur={editable ? handleBlur : undefined}
        onKeyDown={editable ? handleKeyDown : undefined}
        style={{
          width: sized ? "100%" : undefined, height: sized ? "100%" : undefined,
          overflow: sized ? "hidden" : undefined,
          fontSize: "9pt", whiteSpace: sized ? (multiline ? "pre-line" : "normal") : "nowrap",
          fontFamily: font, color: "#000",
          cursor: editable ? "text" : undefined,
          ...style,
        }}
      >
        {contenido}
      </div>
      {editable && <DragHandle handlers={drag} label={label} />}
      {editable && <ResizeHandle handlers={resize} label={label} />}
    </div>
  );
}

// CSS compartido — cada cliente lo inyecta con un <style> propio (ver
// ImprimirValeClient/ImprimirVoucherClient) para no depender de un archivo
// .css global.
export const CAMPO_POSICIONABLE_CSS = `
  @media screen {
    .cpos-campo { outline: 1px dashed #f43f5e; background: rgba(244,63,94,0.06); padding: 1px 2px; box-sizing: border-box; }
  }
  .cpos-handle { position: absolute; width: 3mm; height: 3mm; border-radius: 2px; box-sizing: border-box; z-index: 10; }
  .cpos-handle-move { top: 0; left: -4mm; background: #3b82f6; cursor: grab; touch-action: none; }
  .cpos-handle-resize { bottom: -1.5mm; right: -1.5mm; background: #10b981; cursor: nwse-resize; touch-action: none; }
`;
