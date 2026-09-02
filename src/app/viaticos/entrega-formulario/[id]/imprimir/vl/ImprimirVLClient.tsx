"use client";
import { useState } from "react";
import { OverlayPrint } from "@/components/overlay-print/OverlayPrint";
import OverlayField from "@/components/overlay-print/OverlayField";
import SelectorFirmante, { type Firmante } from "@/components/SelectorFirmante";
import { montoEnLetras } from "@/lib/adjudicacion/deletreo";

type Comision = {
  id: number; orden: number; lugar: string | null; departamento: string | null;
  descripcion_comision: string | null; dias_calculados: number | null;
  nombramiento_numero: string | null; fecha_nombramiento: string | null;
  firmante_nombre: string | null; firmante_cargo: string | null;
  cantidad_desayuno: number; cantidad_almuerzo: number; cantidad_cena: number; cantidad_hospedaje: number;
};
type Solicitud = {
  id: number; numero_formulario: string | null;
  otros_gastos: number; recibido_va_no: string | null; recibido_va_monto: number | null;
  reintegro: number | null; complemento: number | null;
  persona_nombre: string | null; persona_nit: string | null; persona_cargo: string | null;
  persona_grupo: string | null; persona_no_empleado: string | null; persona_sueldo: number | null;
  persona_categoria_puesto: string | null;
  comisiones: Comision[];
};
type Precios = { desayuno: number; almuerzo: number; cena: number; hospedaje: number };

const Q = (n: number) => n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Si un valor se repite igual al de la fila anterior, se deja en blanco esa
// fila — el cliente pidió que lugar/tipo de comisión no se repitan cuando
// varias comisiones comparten el mismo lugar (2026-08-30).
function dedupeAdyacente(valores: string[]): string[] {
  return valores.map((v, i) => (i > 0 && v === valores[i - 1] ? "" : v));
}

function unicos(valores: (string | null)[]): string[] {
  return [...new Set(valores.filter((v): v is string => !!v))];
}

export default function ImprimirVLClient({
  solicitud: s, entidadRecibio, municipio, nombreResponsable, partidaPresupuestaria, precios, firmantes,
}: {
  solicitud: Solicitud; entidadRecibio: string; municipio: string;
  nombreResponsable: string; partidaPresupuestaria: string; precios: Precios; firmantes: Firmante[];
}) {
  const [firmante, setFirmante] = useState<Firmante | null>(null);
  const voBoNombre = firmante?.nombre ?? "___________________________";
  const voBoCargo = firmante?.cargo ?? "";

  const diasTotal = s.comisiones.reduce((sum, c) => sum + (c.dias_calculados ?? 0), 0);
  const cantDesayuno = s.comisiones.reduce((sum, c) => sum + c.cantidad_desayuno, 0);
  const cantAlmuerzo = s.comisiones.reduce((sum, c) => sum + c.cantidad_almuerzo, 0);
  const cantCena = s.comisiones.reduce((sum, c) => sum + c.cantidad_cena, 0);
  const cantHospedaje = s.comisiones.reduce((sum, c) => sum + c.cantidad_hospedaje, 0);
  const montoDesayuno = cantDesayuno * precios.desayuno;
  const montoAlmuerzo = cantAlmuerzo * precios.almuerzo;
  const montoCena = cantCena * precios.cena;
  const montoHospedaje = cantHospedaje * precios.hospedaje;
  const sumaGastos = montoDesayuno + montoAlmuerzo + montoCena + montoHospedaje;
  const total11 = sumaGastos + s.otros_gastos;
  const tieneAnticipo = !!s.recibido_va_no;
  const total15 = total11 - (s.reintegro ?? 0) + (s.complemento ?? 0);

  const tipoComisionLineas = dedupeAdyacente(s.comisiones.map(c => c.descripcion_comision ?? ""));
  const lugarLineas = dedupeAdyacente(s.comisiones.map(c => [c.lugar, c.departamento].filter(Boolean).join(", ")));
  const nombramientosTexto = unicos(s.comisiones.map(c => c.nombramiento_numero)).join(", ");
  const fechasNombramientoTexto = unicos(s.comisiones.map(c => c.fecha_nombramiento)).map(fechaCorta).join(", ");
  const primerFirmante = s.comisiones.find(c => c.firmante_nombre)?.firmante_nombre ?? "";
  const primerFirmanteCargo = s.comisiones.find(c => c.firmante_nombre)?.firmante_cargo ?? "";

  return (
    <OverlayPrint storageKey="overlay-offset-viatico-vl" title={`Planilla de Viático — Formulario V-L ${s.numero_formulario ?? ""}`}
      extraToolbar={<SelectorFirmante label="Vo.Bo." firmantes={firmantes} value={firmante} onChange={setFirmante} />}
    >
      <OverlayField top={1.08} left={5.6} width={2.2} bold size={11}>{Q(total15)}</OverlayField>
      <OverlayField top={1.52} left={1.35} width={6.4}>{entidadRecibio}</OverlayField>
      <OverlayField top={1.85} left={1.85} width={5.9}>{montoEnLetras(total15).replace(/\.$/, "")}</OverlayField>

      <OverlayField top={2.62} left={0.65} width={2.35} size={8}>{tipoComisionLineas.join("\n")}</OverlayField>
      <OverlayField top={2.62} left={3.2} width={0.9} size={8}>{lugarLineas.join("\n")}</OverlayField>
      <OverlayField top={2.65} left={4.2} width={0.6} align="center">{diasTotal}</OverlayField>

      {cantDesayuno > 0 && <OverlayField top={2.66} left={6.6} width={1.2} align="right">{Q(montoDesayuno)}</OverlayField>}
      {cantAlmuerzo > 0 && <OverlayField top={3.09} left={6.6} width={1.2} align="right">{Q(montoAlmuerzo)}</OverlayField>}
      {cantCena > 0 && <OverlayField top={3.52} left={6.6} width={1.2} align="right">{Q(montoCena)}</OverlayField>}
      {cantHospedaje > 0 && <OverlayField top={3.95} left={6.6} width={1.2} align="right">{Q(montoHospedaje)}</OverlayField>}

      <OverlayField top={4.30} left={7.0} width={0.9} align="right">{Q(sumaGastos)}</OverlayField>
      <OverlayField top={4.57} left={7.0} width={0.9} align="right">{Q(s.otros_gastos)}</OverlayField>
      <OverlayField top={4.84} left={7.0} width={0.9} align="right" bold>{Q(total11)}</OverlayField>

      {tieneAnticipo && <OverlayField top={4.98} left={7.0} width={0.9} align="right">{Q(s.recibido_va_monto ?? 0)}</OverlayField>}
      {tieneAnticipo && s.reintegro != null && <OverlayField top={5.10} left={7.0} width={0.9} align="right">{Q(s.reintegro)}</OverlayField>}
      {tieneAnticipo && s.complemento != null && <OverlayField top={5.22} left={7.0} width={0.9} align="right">{Q(s.complemento)}</OverlayField>}
      <OverlayField top={5.34} left={7.0} width={0.9} align="right" bold>{Q(total15)}</OverlayField>

      <OverlayField top={5.47} left={0.95} width={3.3}>{s.persona_nombre}</OverlayField>
      <OverlayField top={5.47} left={5.4} width={1.8} mono>{s.persona_nit}</OverlayField>
      <OverlayField top={5.80} left={0.9} width={2.0}>{s.persona_cargo}</OverlayField>
      <OverlayField top={5.80} left={4.9} width={1.0}>{s.persona_grupo}</OverlayField>
      <OverlayField top={6.12} left={1.95} width={1.4} mono>{s.persona_no_empleado}</OverlayField>
      <OverlayField top={6.12} left={5.3} width={1.2}>{s.persona_sueldo != null ? Q(s.persona_sueldo) : ""}</OverlayField>
      <OverlayField top={6.45} left={2.05} width={1.4}>{s.persona_categoria_puesto}</OverlayField>
      <OverlayField top={6.75} left={3.3} width={4.3} size={8} mono>{partidaPresupuestaria}</OverlayField>

      <OverlayField top={8.40} left={2.7} width={3} size={9}>{nombramientosTexto}</OverlayField>
      <OverlayField top={8.65} left={1.5} width={4}>{primerFirmante}</OverlayField>
      <OverlayField top={8.95} left={1.1} width={5} size={8.5}>{primerFirmanteCargo}</OverlayField>
      <OverlayField top={9.40} left={1.7} width={4}>{municipio}   {fechasNombramientoTexto}</OverlayField>

      <OverlayField top={9.60} left={1.7} width={3}>{nombreResponsable}</OverlayField>
      <OverlayField top={9.75} left={1.3} width={3}>{voBoNombre}</OverlayField>
    </OverlayPrint>
  );
}
