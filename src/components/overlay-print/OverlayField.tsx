"use client";
import type { CSSProperties, ReactNode } from "react";
import { useOverlayOffset } from "./OverlayPrint";

interface Props {
  top: number;
  left: number;
  width?: number;
  align?: "left" | "center" | "right";
  size?: number;
  bold?: boolean;
  mono?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

// Un dato posicionado por coordenadas absolutas (en pulgadas) sobre la hoja carta —
// nunca lleva borde ni fondo, porque la casilla que lo recibe ya está impresa en el papel.
export default function OverlayField({
  top, left, width, align = "left", size = 9, bold, mono, className = "", style, children,
}: Props) {
  const offset = useOverlayOffset();
  if (children === null || children === undefined || children === "") return null;
  return (
    <div
      className={className}
      style={{
        position: "absolute",
        top: `${top + offset.y}in`,
        left: `${left + offset.x}in`,
        width: width ? `${width}in` : undefined,
        textAlign: align,
        fontSize: `${size}pt`,
        fontFamily: mono ? "monospace" : "Arial, Helvetica, sans-serif",
        fontWeight: bold ? 700 : 400,
        lineHeight: 1.15,
        whiteSpace: "pre-wrap",
        color: "#000",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
