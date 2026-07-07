"use client";
import { OverlayPrint } from "@/components/overlay-print/OverlayPrint";
import OverlayField from "@/components/overlay-print/OverlayField";

type Requisicion = {
  id: number; no_pedido: string; fecha_emision: string; clave_administrativa: string;
  sala_servicio: string; bodega: string; fecha_despacho: string | null;
  solicita_nombre: string; solicita_no_empleado: string; solicita_cargo: string;
  entrega_nombre: string | null; entrega_no_empleado: string | null; entrega_cargo: string | null;
  recibe_nombre: string | null; recibe_no_empleado: string | null; recibe_cargo: string | null;
  director_nombre: string | null;
  items: { codigo: string; nombre: string; cantidad_solicitada: number }[];
};

function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Filas de la tabla de insumos del DAB-75, medidas directamente sobre el PDF de
// referencia (14 filas disponibles en la hoja pre-impresa).
const ROW_TOPS = [2.375, 2.72, 3.095, 3.475, 3.855, 4.215, 4.595, 4.975, 5.345, 5.715, 6.095, 6.475, 6.845, 7.215];

const BOXES = {
  solicita: 0.21,
  entrega: 2.91,
  recibe: 5.655,
};

export default function ImprimirDab75Client({ requisicion: r }: { requisicion: Requisicion }) {
  return (
    <OverlayPrint storageKey="overlay-offset-dab75" title={`DAB-75 — Pedido ${r.no_pedido}`}>
      <OverlayField top={1.30} left={0.30} width={0.9}>{r.no_pedido}</OverlayField>
      <OverlayField top={1.30} left={1.50} width={1.15}>{fechaCorta(r.fecha_emision)}</OverlayField>
      <OverlayField top={1.30} left={3.00} width={1.7}>{r.clave_administrativa}</OverlayField>
      <OverlayField top={1.30} left={5.00} width={3.2}>{r.sala_servicio}</OverlayField>

      {r.bodega === "I" && <OverlayField top={1.60} left={1.80} bold>X</OverlayField>}
      {r.bodega === "II" && <OverlayField top={1.60} left={3.45} bold>X</OverlayField>}

      <OverlayField top={1.95} left={7.05} width={1.2}>{fechaCorta(r.fecha_despacho)}</OverlayField>

      {r.items.slice(0, 14).map((it, i) => (
        <div key={i}>
          <OverlayField top={ROW_TOPS[i] + 0.10} left={0.30} width={0.8} size={8.5}>{it.codigo}</OverlayField>
          <OverlayField top={ROW_TOPS[i] + 0.10} left={1.25} width={3.4} size={8.5}>{it.nombre}</OverlayField>
          <OverlayField top={ROW_TOPS[i] + 0.10} left={4.9} width={0.65} align="center" size={8.5}>
            {it.cantidad_solicitada.toLocaleString("es-GT")}
          </OverlayField>
        </div>
      ))}

      <OverlayField top={7.645} left={BOXES.solicita + 0.60} width={1.95}>{r.solicita_nombre}</OverlayField>
      <OverlayField top={8.18} left={BOXES.solicita + 1.05} width={1.5} size={8.5}>{r.solicita_no_empleado}</OverlayField>
      <OverlayField top={8.455} left={BOXES.solicita + 0.55} width={2.0} size={8.5}>{r.solicita_cargo}</OverlayField>

      <OverlayField top={7.645} left={BOXES.entrega + 0.60} width={1.95}>{r.entrega_nombre}</OverlayField>
      <OverlayField top={8.18} left={BOXES.entrega + 1.05} width={1.5} size={8.5}>{r.entrega_no_empleado}</OverlayField>
      <OverlayField top={8.455} left={BOXES.entrega + 0.55} width={2.0} size={8.5}>{r.entrega_cargo}</OverlayField>

      <OverlayField top={7.645} left={BOXES.recibe + 0.60} width={1.95}>{r.recibe_nombre}</OverlayField>
      <OverlayField top={8.18} left={BOXES.recibe + 1.05} width={1.5} size={8.5}>{r.recibe_no_empleado}</OverlayField>
      <OverlayField top={8.455} left={BOXES.recibe + 0.55} width={2.0} size={8.5}>{r.recibe_cargo}</OverlayField>

      <OverlayField top={9.40} left={0.81} width={3.0}>{r.director_nombre}</OverlayField>
    </OverlayPrint>
  );
}
