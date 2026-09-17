"use client";
import { useState, useCallback, useRef, useLayoutEffect } from "react";
import { guardarPosicionesImpresion, getFondoImpresion } from "@/lib/impresion-posiciones-actions";
import { Campo, CAMPO_POSICIONABLE_CSS, type Pos } from "@/components/print-posiciones/CampoPosicionable";
import { PosicionesToolbar, HojaConFondo, HOJA_CON_FONDO_CSS } from "@/components/print-posiciones/PosicionesToolbar";
import SelectorFirmante, { type Firmante } from "@/components/SelectorFirmante";
import { montoEnLetras } from "@/lib/adjudicacion/deletreo";

const HOJA_W_MM = 215.9;
const HOJA_H_MM = 279.4;
const IN = 25.4;

type Comision = {
  id: number; orden: number; lugar: string | null; departamento: string | null;
  tipo_comision: string | null; descripcion_comision: string | null; dias_calculados: number | null;
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

// Posiciones (mm) convertidas del calibrado original en pulgadas — ahora
// ajustables/arrastrables y persistentes (2026-09-07, mismo sistema del
// DAB-60/Vale/Cheque, ver CampoPosicionable/PosicionesToolbar), ya no fijas
// en el código como antes con OverlayField.
const POS_DEFAULT: Record<string, Pos> = {
  por_q:               { top: 1.08 * IN, left: 5.6 * IN, width: 2.2 * IN },
  entidad_recibio:     { top: 1.52 * IN, left: 1.35 * IN, width: 6.4 * IN },
  monto_letras:        { top: 1.85 * IN, left: 1.85 * IN, width: 5.9 * IN },

  tipo_comision:       { top: 2.62 * IN, left: 0.65 * IN, width: 2.35 * IN },
  lugar:               { top: 2.62 * IN, left: 3.2 * IN, width: 0.9 * IN },
  dias:                { top: 2.65 * IN, left: 4.2 * IN, width: 0.6 * IN },

  // Cantidad (numeral 7) — reportado por el cliente 2026-09-17: solo se
  // imprimía el monto por servicio, nunca cuántos de cada uno; posiciones
  // estimadas a ojo, se ajustan arrastrando en "Ver posiciones" igual que
  // el resto de campos de este formulario.
  cant_desayuno:       { top: 2.66 * IN, left: 5.5 * IN, width: 0.45 * IN },
  cant_almuerzo:       { top: 3.09 * IN, left: 5.5 * IN, width: 0.45 * IN },
  cant_cena:           { top: 3.52 * IN, left: 5.5 * IN, width: 0.45 * IN },
  cant_hospedaje:      { top: 3.95 * IN, left: 5.5 * IN, width: 0.45 * IN },

  // Precio unitario (numeral 7) — pedido explícito del cliente 2026-09-17:
  // "debe llevar primero la cantidad... luego el precio, y a la par el
  // total, que es el producto del precio por la cantidad" — antes solo se
  // imprimían cantidad y total, el precio unitario nunca salía como dato
  // propio (aunque en el papel físico real pueda venir pre-impreso, el PDF
  // digital tiene que traerlo solo). El `top` de cada fila NO usa el mismo
  // estimado original de cant_*/gasto_* (2.66/3.09/3.52/3.95 * IN) — esos
  // dos campos ya se recalibraron y guardaron por el cliente vía "Ver
  // posiciones" desde que se agregaron (fila real más abajo de lo
  // estimado), así que precio_* arranca ya alineado a esa fila real en vez
  // de nacer descuadrado un renglón más arriba (bug real detectado
  // 2026-09-17: el campo nuevo, sin posición guardada todavía, caía en el
  // estimado viejo mientras sus vecinos ya estaban en la posición
  // corregida). Sigue siendo editable/arrastrable igual que los demás.
  precio_desayuno:     { top: 75.2, left: 6.0 * IN, width: 0.55 * IN },
  precio_almuerzo:     { top: 82.7, left: 6.0 * IN, width: 0.55 * IN },
  precio_cena:         { top: 90.5, left: 6.0 * IN, width: 0.55 * IN },
  precio_hospedaje:    { top: 97.2, left: 6.0 * IN, width: 0.55 * IN },

  gasto_desayuno:      { top: 2.66 * IN, left: 6.6 * IN, width: 1.2 * IN },
  gasto_almuerzo:      { top: 3.09 * IN, left: 6.6 * IN, width: 1.2 * IN },
  gasto_cena:          { top: 3.52 * IN, left: 6.6 * IN, width: 1.2 * IN },
  gasto_hospedaje:     { top: 3.95 * IN, left: 6.6 * IN, width: 1.2 * IN },

  suma_gastos:         { top: 4.30 * IN, left: 7.0 * IN, width: 0.9 * IN },
  otros_gastos:        { top: 4.57 * IN, left: 7.0 * IN, width: 0.9 * IN },
  total_11:            { top: 4.84 * IN, left: 7.0 * IN, width: 0.9 * IN },

  recibido_va:         { top: 4.98 * IN, left: 7.0 * IN, width: 0.9 * IN },
  reintegro:           { top: 5.10 * IN, left: 7.0 * IN, width: 0.9 * IN },
  complemento:         { top: 5.22 * IN, left: 7.0 * IN, width: 0.9 * IN },
  total_15:            { top: 5.34 * IN, left: 7.0 * IN, width: 0.9 * IN },

  persona_nombre:      { top: 5.47 * IN, left: 0.95 * IN, width: 3.3 * IN },
  persona_nit:         { top: 5.47 * IN, left: 5.4 * IN, width: 1.8 * IN },
  persona_cargo:       { top: 5.80 * IN, left: 0.9 * IN, width: 2.0 * IN },
  persona_grupo:       { top: 5.80 * IN, left: 4.9 * IN, width: 1.0 * IN },
  persona_no_empleado: { top: 6.12 * IN, left: 1.95 * IN, width: 1.4 * IN },
  persona_sueldo:      { top: 6.12 * IN, left: 5.3 * IN, width: 1.2 * IN },
  persona_categoria:   { top: 6.45 * IN, left: 2.05 * IN, width: 1.4 * IN },
  partida:             { top: 6.75 * IN, left: 3.3 * IN, width: 4.3 * IN },

  nombramientos:       { top: 8.40 * IN, left: 2.7 * IN, width: 3 * IN },
  firmante_nombre:     { top: 8.65 * IN, left: 1.5 * IN, width: 4 * IN },
  firmante_cargo:      { top: 8.95 * IN, left: 1.1 * IN, width: 5 * IN },
  lugar_fecha:         { top: 9.40 * IN, left: 1.7 * IN, width: 4 * IN },

  responsable_nombre:  { top: 9.60 * IN, left: 1.7 * IN, width: 3 * IN },
  vobo_nombre:         { top: 9.75 * IN, left: 1.3 * IN, width: 3 * IN },
};

const FIELD_LABELS: Record<string, string> = {
  por_q: "1. POR Q.", entidad_recibio: "2. RECIBÍ DE", monto_letras: "3. LA CANTIDAD DE",
  tipo_comision: "4. TIPO DE COMISIÓN", lugar: "5. LUGAR DE PERMANENCIA", dias: "6. No. DE DÍAS",
  cant_desayuno: "7. Cantidad Desayuno", cant_almuerzo: "7. Cantidad Almuerzo", cant_cena: "7. Cantidad Cena", cant_hospedaje: "7. Cantidad Hospedaje",
  precio_desayuno: "7. Precio Desayuno", precio_almuerzo: "7. Precio Almuerzo", precio_cena: "7. Precio Cena", precio_hospedaje: "7. Precio Hospedaje",
  gasto_desayuno: "Desayuno", gasto_almuerzo: "Almuerzo", gasto_cena: "Cena", gasto_hospedaje: "Hospedaje",
  suma_gastos: "9. SUMAN LOS GASTOS DE VIÁTICO", otros_gastos: "10. OTROS GASTOS DERIVADOS", total_11: "11. TOTAL",
  recibido_va: "12. RECIBIDO POR MEDIO DE FORMULARIO V-A", reintegro: "13. REINTEGRO", complemento: "14. COMPLEMENTO", total_15: "15. TOTAL",
  persona_nombre: "16. NOMBRE", persona_nit: "17. NIT", persona_cargo: "18. CARGO", persona_grupo: "19. GRUPO",
  persona_no_empleado: "20. NÚMERO DE EMPLEADO", persona_sueldo: "21. SUELDO", persona_categoria: "22. CATEGORÍA DE PUESTO",
  partida: "24. NÚMERO DE PARTIDA PRESUPUESTARIA",
  nombramientos: "25. NOMBRAMIENTO NÚMERO", firmante_nombre: "26. EMITIDO POR", firmante_cargo: "27. CARGO",
  lugar_fecha: "29. LUGAR Y FECHA", responsable_nombre: "30. REVISADO POR", vobo_nombre: "31. Vo.Bo.",
};

interface Props {
  solicitud: Solicitud; entidadRecibio: string; municipio: string;
  partidaPresupuestaria: string; precios: Precios; firmantes: Firmante[];
  posicionesGuardadas: Record<string, Pos>;
}

export default function ImprimirVLClient({
  solicitud: s, entidadRecibio, municipio, partidaPresupuestaria, precios, firmantes,
  posicionesGuardadas,
}: Props) {
  const [firmante, setFirmante] = useState<Firmante | null>(null);
  const voBoNombre = firmante?.nombre ?? "___________________________";
  // "REVISADO POR" (numeral 30) — corregido 2026-09-17, revirtiendo el
  // campo fijo de Configuración (nombre_responsable): el cliente reportó
  // que ese valor no reflejaba a quien realmente revisa cada viático (el
  // encargado de Fondo Rotativo puede cambiar) — mismo selector del
  // catálogo de Firmantes que ya usa Vo.Bo., sin persistir, se elige cada
  // vez que se imprime.
  const [firmanteRevisor, setFirmanteRevisor] = useState<Firmante | null>(null);
  const revisorNombre = firmanteRevisor?.nombre ?? "___________________________";

  const [verPosiciones, setVerPosiciones] = useState(false);
  const [pos, setPos] = useState<Record<string, Pos>>({ ...POS_DEFAULT, ...posicionesGuardadas });
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [fondo, setFondo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const hojaRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!fondo) getFondoImpresion("viatico_vl").then(setFondo);
  }, [fondo]);

  const onChangePos = useCallback((id: string, next: Pos) => {
    setPos(p => ({ ...p, [id]: next }));
  }, []);
  const onTextChange = useCallback((id: string, texto: string) => {
    setOverrides(o => ({ ...o, [id]: texto }));
  }, []);

  async function guardarPosiciones() {
    setGuardando(true);
    await guardarPosicionesImpresion("viatico_vl", pos);
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  }
  function restablecerPosiciones() {
    setPos({ ...POS_DEFAULT });
  }

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

  // El numeral 4 "TIPO DE COMISIÓN" imprime el campo corto tipo_comision, no
  // la descripción larga — el cliente lo confirmó explícitamente 2026-09-07
  // (antes se interpretó al revés, ver nota en CLAUDE.md). descripcion_comision
  // va en el Informe de Comisión, no acá. Cae a descripcion_comision solo si
  // tipo_comision viene vacío (es un campo opcional del formulario).
  const tipoComisionLineas = dedupeAdyacente(s.comisiones.map(c => c.tipo_comision || c.descripcion_comision || ""));
  const lugarLineas = dedupeAdyacente(s.comisiones.map(c => [c.lugar, c.departamento].filter(Boolean).join(", ")));
  const nombramientosTexto = unicos(s.comisiones.map(c => c.nombramiento_numero)).join(", ");
  const fechasNombramientoTexto = unicos(s.comisiones.map(c => c.fecha_nombramiento)).map(fechaCorta).join(", ");
  const primerFirmante = s.comisiones.find(c => c.firmante_nombre)?.firmante_nombre ?? "";
  const primerFirmanteCargo = s.comisiones.find(c => c.firmante_nombre)?.firmante_cargo ?? "";

  const campo = (id: string, textoDefault: string, opts?: { style?: React.CSSProperties; multiline?: boolean }) => {
    const texto = overrides[id] ?? textoDefault;
    return (
      <Campo
        id={id} texto={texto} hojaRef={hojaRef} hojaWMm={HOJA_W_MM} hojaHMm={HOJA_H_MM}
        pos={pos[id] ?? POS_DEFAULT[id]} onChange={onChangePos}
        editable={verPosiciones} style={opts?.style} label={FIELD_LABELS[id] ?? id}
        onTextChange={onTextChange} multiline={opts?.multiline}
      />
    );
  };

  return (
    <>
      <PosicionesToolbar
        titulo={`Planilla de Viático — Formulario V-L ${s.numero_formulario ?? ""}`}
        verPosiciones={verPosiciones} onToggleVer={() => setVerPosiciones(p => !p)}
        onRestablecer={restablecerPosiciones} onGuardar={guardarPosiciones}
        guardando={guardando} guardado={guardado}
        extraToolbar={<>
          <SelectorFirmante label="Revisado por" firmantes={firmantes} value={firmanteRevisor} onChange={setFirmanteRevisor} />
          <SelectorFirmante label="Vo.Bo." firmantes={firmantes} value={firmante} onChange={setFirmante} />
        </>}
      />

      <HojaConFondo hojaRef={hojaRef} fondo={fondo}>
        {campo("por_q", Q(total15), { style: { fontWeight: 700, fontSize: "11pt" } })}
        {campo("entidad_recibio", entidadRecibio)}
        {campo("monto_letras", montoEnLetras(total15).replace(/\.$/, ""))}

        {campo("tipo_comision", tipoComisionLineas.join("\n"), { style: { fontSize: "8pt" }, multiline: true })}
        {campo("lugar", lugarLineas.join("\n"), { style: { fontSize: "8pt" }, multiline: true })}
        {campo("dias", String(diasTotal), { style: { textAlign: "center" } })}

        {cantDesayuno > 0 && campo("cant_desayuno", String(cantDesayuno), { style: { textAlign: "center" } })}
        {cantAlmuerzo > 0 && campo("cant_almuerzo", String(cantAlmuerzo), { style: { textAlign: "center" } })}
        {cantCena > 0 && campo("cant_cena", String(cantCena), { style: { textAlign: "center" } })}
        {cantHospedaje > 0 && campo("cant_hospedaje", String(cantHospedaje), { style: { textAlign: "center" } })}

        {cantDesayuno > 0 && campo("precio_desayuno", Q(precios.desayuno), { style: { textAlign: "right" } })}
        {cantAlmuerzo > 0 && campo("precio_almuerzo", Q(precios.almuerzo), { style: { textAlign: "right" } })}
        {cantCena > 0 && campo("precio_cena", Q(precios.cena), { style: { textAlign: "right" } })}
        {cantHospedaje > 0 && campo("precio_hospedaje", Q(precios.hospedaje), { style: { textAlign: "right" } })}

        {cantDesayuno > 0 && campo("gasto_desayuno", Q(montoDesayuno), { style: { textAlign: "right" } })}
        {cantAlmuerzo > 0 && campo("gasto_almuerzo", Q(montoAlmuerzo), { style: { textAlign: "right" } })}
        {cantCena > 0 && campo("gasto_cena", Q(montoCena), { style: { textAlign: "right" } })}
        {cantHospedaje > 0 && campo("gasto_hospedaje", Q(montoHospedaje), { style: { textAlign: "right" } })}

        {campo("suma_gastos", Q(sumaGastos), { style: { textAlign: "right" } })}
        {campo("otros_gastos", Q(s.otros_gastos), { style: { textAlign: "right" } })}
        {campo("total_11", Q(total11), { style: { textAlign: "right", fontWeight: 700 } })}

        {tieneAnticipo && campo("recibido_va", Q(s.recibido_va_monto ?? 0), { style: { textAlign: "right" } })}
        {tieneAnticipo && s.reintegro != null && campo("reintegro", Q(s.reintegro), { style: { textAlign: "right" } })}
        {tieneAnticipo && s.complemento != null && campo("complemento", Q(s.complemento), { style: { textAlign: "right" } })}
        {campo("total_15", Q(total15), { style: { textAlign: "right", fontWeight: 700 } })}

        {campo("persona_nombre", s.persona_nombre ?? "")}
        {campo("persona_nit", s.persona_nit ?? "", { style: { fontFamily: "monospace" } })}
        {campo("persona_cargo", s.persona_cargo ?? "")}
        {campo("persona_grupo", s.persona_grupo ?? "")}
        {campo("persona_no_empleado", s.persona_no_empleado ?? "", { style: { fontFamily: "monospace" } })}
        {campo("persona_sueldo", s.persona_sueldo != null ? Q(s.persona_sueldo) : "")}
        {campo("persona_categoria", s.persona_categoria_puesto ?? "")}
        {campo("partida", partidaPresupuestaria, { style: { fontSize: "8pt", fontFamily: "monospace" } })}

        {campo("nombramientos", nombramientosTexto)}
        {campo("firmante_nombre", primerFirmante)}
        {campo("firmante_cargo", primerFirmanteCargo, { style: { fontSize: "8.5pt" } })}
        {campo("lugar_fecha", `${municipio}   ${fechasNombramientoTexto}`)}

        {campo("responsable_nombre", revisorNombre)}
        {campo("vobo_nombre", voBoNombre)}
      </HojaConFondo>

      <style>{HOJA_CON_FONDO_CSS}</style>
      {verPosiciones && <style>{CAMPO_POSICIONABLE_CSS}</style>}
    </>
  );
}
