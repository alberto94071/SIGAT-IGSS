"use client";
import { OverlayPrint } from "@/components/overlay-print/OverlayPrint";
import OverlayField from "@/components/overlay-print/OverlayField";
import { montoEnLetras } from "@/lib/adjudicacion/deletreo";
import type { Comision } from "../../actions";

type Liquidacion = {
  id: number; comisiones: Comision[]; dias: number;
  gasto_desayuno: number | null; gasto_almuerzo: number | null; gasto_cena: number | null; gasto_hospedaje: number | null;
  otros_gastos: number;
  recibido_va_no: string | null; recibido_va_monto: number | null;
  reintegro: number | null; complemento: number | null;
  forma_pago: string | null; fecha_pago: string | null;
  persona_nombre: string; persona_nit: string; persona_cargo: string; persona_grupo: string | null;
  persona_no_empleado: string; persona_sueldo: number | null; persona_categoria_puesto: string | null;
  partida_presupuestaria: string | null; nombramiento_numero: string | null; fecha_nombramiento: string | null;
};

interface Props {
  liquidacion: Liquidacion;
  entidadRecibio: string; municipio: string;
  nombreResponsable: string; nombreEncargadoUnidad: string; cargoEncargadoUnidad: string;
}

const Q = (n: number) => n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function ImprimirViaticoClient({
  liquidacion: l, entidadRecibio, municipio, nombreResponsable, nombreEncargadoUnidad, cargoEncargadoUnidad,
}: Props) {
  const sumaGastos = (l.gasto_desayuno ?? 0) + (l.gasto_almuerzo ?? 0) + (l.gasto_cena ?? 0) + (l.gasto_hospedaje ?? 0);
  const total11 = sumaGastos + l.otros_gastos;
  const tieneAnticipo = !!l.recibido_va_no;
  const total15 = total11 - (l.reintegro ?? 0) + (l.complemento ?? 0);

  return (
    <OverlayPrint storageKey="overlay-offset-viatico" title="Planilla de Viático — Formulario V-L">
      <OverlayField top={1.08} left={5.6} width={2.2} bold size={11}>{Q(total15)}</OverlayField>
      <OverlayField top={1.52} left={1.35} width={6.4}>{entidadRecibio}</OverlayField>
      <OverlayField top={1.85} left={1.85} width={5.9}>{montoEnLetras(total15).replace(/\.$/, "")}</OverlayField>

      <OverlayField top={2.62} left={0.65} width={2.35} size={8}>
        {l.comisiones.map(c => c.tipo).filter(Boolean).join("\n")}
      </OverlayField>
      <OverlayField top={2.62} left={3.2} width={0.9} size={8}>
        {l.comisiones.map(c => c.lugar).filter(Boolean).join("\n")}
      </OverlayField>
      <OverlayField top={2.65} left={4.2} width={0.6} align="center">{l.dias}</OverlayField>

      {l.gasto_desayuno != null && <OverlayField top={2.66} left={6.6} width={1.2} align="right">{Q(l.gasto_desayuno)}</OverlayField>}
      {l.gasto_almuerzo != null && <OverlayField top={3.09} left={6.6} width={1.2} align="right">{Q(l.gasto_almuerzo)}</OverlayField>}
      {l.gasto_cena != null && <OverlayField top={3.52} left={6.6} width={1.2} align="right">{Q(l.gasto_cena)}</OverlayField>}
      {l.gasto_hospedaje != null && <OverlayField top={3.95} left={6.6} width={1.2} align="right">{Q(l.gasto_hospedaje)}</OverlayField>}

      <OverlayField top={4.30} left={7.0} width={0.9} align="right">{Q(sumaGastos)}</OverlayField>
      <OverlayField top={4.57} left={7.0} width={0.9} align="right">{Q(l.otros_gastos)}</OverlayField>
      <OverlayField top={4.84} left={7.0} width={0.9} align="right" bold>{Q(total11)}</OverlayField>

      {tieneAnticipo && <OverlayField top={4.98} left={7.0} width={0.9} align="right">{Q(l.recibido_va_monto ?? 0)}</OverlayField>}
      {tieneAnticipo && l.reintegro != null && <OverlayField top={5.10} left={7.0} width={0.9} align="right">{Q(l.reintegro)}</OverlayField>}
      {tieneAnticipo && l.complemento != null && <OverlayField top={5.22} left={7.0} width={0.9} align="right">{Q(l.complemento)}</OverlayField>}
      <OverlayField top={5.34} left={7.0} width={0.9} align="right" bold>{Q(total15)}</OverlayField>

      <OverlayField top={5.05} left={3.55} width={1.2}>{fechaCorta(l.fecha_pago)}</OverlayField>
      <OverlayField top={5.28} left={3.3} width={1.6}>{l.forma_pago}</OverlayField>

      <OverlayField top={5.47} left={0.95} width={3.3}>{l.persona_nombre}</OverlayField>
      <OverlayField top={5.47} left={5.4} width={1.8} mono>{l.persona_nit}</OverlayField>
      <OverlayField top={5.80} left={0.9} width={2.0}>{l.persona_cargo}</OverlayField>
      <OverlayField top={5.80} left={4.9} width={1.0}>{l.persona_grupo}</OverlayField>
      <OverlayField top={6.12} left={1.95} width={1.4} mono>{l.persona_no_empleado}</OverlayField>
      <OverlayField top={6.12} left={5.3} width={1.2}>{l.persona_sueldo != null ? Q(l.persona_sueldo) : ""}</OverlayField>
      <OverlayField top={6.45} left={2.05} width={1.4}>{l.persona_categoria_puesto}</OverlayField>
      <OverlayField top={6.75} left={3.3} width={4.3} size={8} mono>{l.partida_presupuestaria}</OverlayField>

      <OverlayField top={8.40} left={2.7} width={3}>{l.nombramiento_numero}</OverlayField>
      <OverlayField top={8.65} left={1.5} width={4}>{nombreEncargadoUnidad}</OverlayField>
      <OverlayField top={8.95} left={1.1} width={5} size={8.5}>{cargoEncargadoUnidad}</OverlayField>
      <OverlayField top={9.40} left={1.7} width={4}>{municipio}   {fechaCorta(l.fecha_nombramiento)}</OverlayField>

      <OverlayField top={9.60} left={1.7} width={3}>{nombreResponsable}</OverlayField>
      <OverlayField top={9.75} left={1.3} width={3}>{nombreEncargadoUnidad}</OverlayField>
    </OverlayPrint>
  );
}
