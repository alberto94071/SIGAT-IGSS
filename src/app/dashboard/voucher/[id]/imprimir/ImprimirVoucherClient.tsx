"use client";
import { OverlayPrint } from "@/components/overlay-print/OverlayPrint";
import OverlayField from "@/components/overlay-print/OverlayField";

type Vale = {
  numero: number; tipo: string; motivo: string; monto: number; monto_autorizado: number | null;
  numero_cheque: string | null; destinatario_cheque: string | null; fecha_emision: string | null;
  solicitante_nombre: string; jefe_nombre: string;
};

interface Props {
  vale: Vale;
  montoEnLetras: string;
  municipio: string;
  codigoContable: string;
}

function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function partesFecha(iso: string | null): { dia: string; mes: string; anio: string } {
  if (!iso) return { dia: "", mes: "", anio: "" };
  const [anio, mes, dia] = iso.split("-");
  return { dia, mes, anio };
}

const TIPO_LABEL: Record<string, string> = { pasajes: "Vale de Pago de Pasajes", gastos_varios: "Vale de Gastos Varios" };

export default function ImprimirVoucherClient({ vale: v, montoEnLetras, municipio, codigoContable }: Props) {
  const monto = v.monto_autorizado ?? v.monto;
  const { dia, mes, anio } = partesFecha(v.fecha_emision);

  return (
    <OverlayPrint storageKey="overlay-offset-voucher" title={`Voucher — Cheque ${v.numero_cheque}`}>
      <OverlayField top={0.22} left={6.1} width={1.5} align="right" bold mono>{v.numero_cheque}</OverlayField>
      <OverlayField top={0.78} left={2.0} width={4.3}>{municipio}, {fechaCorta(v.fecha_emision)}</OverlayField>
      <OverlayField top={0.78} left={6.35} width={1.2} align="right" bold>{monto.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</OverlayField>
      <OverlayField top={1.15} left={2.0} width={5.9}>{v.destinatario_cheque}</OverlayField>
      <OverlayField top={1.45} left={1.6} width={6.4} size={8.5}>{montoEnLetras}</OverlayField>

      <OverlayField top={3.78} left={0.6} width={1.0} align="center" size={8}>{codigoContable}</OverlayField>
      <OverlayField top={3.78} left={1.7} width={3.9} size={8.5}>{TIPO_LABEL[v.tipo] ?? v.tipo} No. {String(v.numero).padStart(7, "0")} — {v.motivo}</OverlayField>
      <OverlayField top={3.78} left={5.85} width={0.85} align="right" mono size={8.5}>{monto.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</OverlayField>

      <OverlayField top={7.85} left={0.55} width={1.5} size={7.5}>{v.solicitante_nombre}</OverlayField>
      <OverlayField top={7.85} left={4.1} width={1.9} size={7.5}>{v.jefe_nombre}</OverlayField>
      <OverlayField top={7.85} left={7.55} width={0.2} align="center" size={7.5}>{dia}</OverlayField>
      <OverlayField top={7.85} left={7.85} width={0.2} align="center" size={7.5}>{mes}</OverlayField>
      <OverlayField top={7.85} left={8.15} width={0.35} align="center" size={7.5}>{anio}</OverlayField>
    </OverlayPrint>
  );
}
