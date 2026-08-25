"use client";
import { fechaGuatemala } from "@/lib/date-utils";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import { deletrearCodigo, fechaEnLetras, horaEnLetras } from "@/lib/adjudicacion/deletreo";
import PrintPages from "@/components/print-pages/PrintPages";
import SelectorFirmante, { type Firmante } from "@/components/SelectorFirmante";
import { marcarActaPrevisualizada } from "@/lib/adjudicacion/actas-adjudicacion-actions";

type Acta = {
  id: number; no_formulario: string; no_acta: string; lugar: string; fecha: string; hora: string;
  previsualizada: boolean;
};
type Consolidacion = {
  id: number; numero: number; anio: number; tipo_compra: string | null;
  numero_adjudicacion: string | null; razon_adjudicacion: string | null; pre_orden: string | null;
  cotizacion_anual_id: number | null; referencia: string | null; nog: string | null;
};
type Oferente = { id: number; nit: string; nombre: string; costo: number; exento_iva: boolean };

interface Props {
  acta: Acta; consolidacion: Consolidacion; oferentes: Oferente[];
  nombreUnidad: string; municipio: string; direccionUnidad: string; nombreResponsable: string;
  firmantes: Firmante[]; descripcion: string;
}

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Comisión fija del Acta de Compra Directa con Oferta Electrónica (modelo
// del cliente, 2026-08-25) — distinta a los firmantes de la Acta genérica,
// hardcodeada tal cual la mandó el proveedor (mismo patrón ya usado para
// "Edwin Baudilio Fuentes Fuentes"/"Elesinda Gabriela Rodríguez Orozco" más
// abajo, que son igual de fijos).
const COMISION_COMPRA_DIRECTA = [
  { nombre: "Licenciada Mirna Magali Mazariegos Pérez", cargo: "Técnico en Trabajo Social, Nombramiento No. 53/2026, Cargo Titular" },
  { nombre: "Sheny Escalante Díaz", cargo: "Enfermera Graduada, Nombramiento No. 52/2026, Cargo Titular" },
  { nombre: "Yenífer Paola Hernández Pérez", cargo: "Secretaria “A”, Nombramiento No. 55/2026, Cargo Titular" },
];

export default function ImprimirActaClient({
  acta, consolidacion: c, oferentes, nombreUnidad, municipio, direccionUnidad, nombreResponsable, firmantes, descripcion,
}: Props) {
  const esCompraDirecta = c.tipo_compra === "Compra Directa";
  const router = useRouter();
  const [municipioNombre, departamento] = municipio.split(",").map(s => s.trim());
  const dep = departamento || "San Marcos";

  // Se marca desde el cliente (no durante el render del server component) para
  // poder revalidar /junta-adjudicadora/acta al mismo tiempo — si no, el
  // Router Cache de esa lista queda desactualizado y el botón "Aprobar" no
  // aparece hasta recargar la página a mano al volver de esta vista previa.
  useEffect(() => {
    if (!acta.previsualizada) marcarActaPrevisualizada(acta.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acta.id]);

  // Encargado(a) de Unidad que preside la Junta — antes venía fijo ("Lilia
  // Zucely Pérez Fuentes"); ahora se elige de Configuración → Firmantes en
  // cada impresión, porque esa persona ya no trabaja ahí.
  const [encargadoUnidad, setEncargadoUnidad] = useState<Firmante | null>(null);
  const nombreEncargadoUnidad = encargadoUnidad?.nombre ?? "___________________________";
  const cargoEncargadoUnidad = encargadoUnidad?.cargo ?? "Encargado(a) de Unidad";

  const fechaTexto = fechaEnLetras(acta.fecha);
  const horaTexto = horaEnLetras(acta.hora);
  const actaDeletreada = deletrearCodigo(acta.no_acta);
  const hoyTexto = fechaEnLetras(fechaGuatemala());

  // Cuerpo principal (encabezado, párrafo legal, tabla de oferentes, TERCERO)
  // y cierre (párrafo final + firmas + pie) — si todo junto no cabe en una
  // sola hoja Carta, el cierre pasa a una segunda hoja en vez de desbordar.
  const cuerpo = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
        <img src="/LOGO_SIAF01.svg" alt="IGSS" style={{ height: "36px", width: "auto" }} />
      </div>

      <p style={{ fontWeight: "bold", fontSize: "9.5pt", margin: "0 0 8px 0" }}>{nombreUnidad}</p>

      <p style={{ fontSize: "9pt", textAlign: "justify", lineHeight: 1.4, margin: "0 0 8px 0" }}>
        EL INFRASCRITO, ENCARGADO DEL FONDO ROTATIVO DE LA {nombreUnidad.toUpperCase()}, CERTIFICA: HABER TENIDO A
        LA VISTA LAS HOJAS MOVIBLES AUTORIZADAS POR LA CONTRALORÍA GENERAL DE CUENTAS DE {dep.toUpperCase()} CON
        REGISTRO NUMERO ELE GUION DOCE GUION CIENTO SESENTA Y SEIS GUION DOS MIL VEINTICINCO (L-12-166-2025) DE
        FECHA TREINTA Y UNO DE MARZO DE DOS MIL VEINTICINCO (31-03-2025), EN EL QUE A FOLIO NUMERO SEIS (6) SE
        ENCUENTRA EL ACTA NUMERO {actaDeletreada} ({acta.no_acta}), QUE LITERALMENTE DICE: {"- ".repeat(20)}
      </p>

      <p style={{ fontWeight: "bold", fontSize: "10.5pt", textAlign: "center", margin: "0 0 8px 0" }}>
        ACTA No. {acta.no_acta}
      </p>

      {esCompraDirecta ? (
        <p style={{ fontSize: "9pt", textAlign: "justify", lineHeight: 1.4 }}>
          En {acta.lugar || municipioNombre}, siendo las {horaTexto} del día {fechaTexto}, las siguientes
          personas: {COMISION_COMPRA_DIRECTA.map((m, i) => (
            <span key={m.nombre}>
              {i > 0 && ", "}{m.nombre}, {m.cargo}{i === COMISION_COMPRA_DIRECTA.length - 1 && ", quien suscribe el acta"}
            </span>
          ))}, de la recepción, apertura, calificación y adjudicación de la Compra Directa con Oferta
          Electrónica de: {descripcion} para {nombreUnidad}, para hacer constar lo siguiente:{" "}
          <strong>PRIMERO:</strong> La comisión nombrada por la máxima autoridad de este Consultorio, informa
          que el motivo de la presente es para conocer sobre ADQUISICIÓN DE: {descripcion}; PARA{" "}
          {nombreUnidad} con número de operación de Guatecompras NOG {c.nog || "—"}.{" "}
          <strong>SEGUNDO:</strong> de conformidad con lo establecido en el artículo veinticuatro (24) del
          Decreto 57-92 del Congreso de la República de la Ley de Contrataciones del Estado y Artículo veinte
          (20) del Acuerdo Gubernativo 122-2016 Reglamento de dicha ley, se procede a la descarga de la
          documentación electrónica del portal de Guatecompras que corresponde al NOG {c.nog || "—"}, dando
          lectura a los nombres de los oferentes y el precio total de las ofertas de acuerdo al cuadro
          siguiente:
        </p>
      ) : (
        <p style={{ fontSize: "9pt", textAlign: "justify", lineHeight: 1.4 }}>
          En el Municipio de {acta.lugar || municipioNombre}, del Departamento de {dep}, siendo las {horaTexto} del
          día {fechaTexto}, reunidos en el local que ocupa la {nombreUnidad}, del Instituto Guatemalteco de
          Seguridad Social, las siguientes personas: {nombreEncargadoUnidad}, {cargoEncargadoUnidad},
          {" "}{nombreResponsable || "Bernon Raúl Miranda González"}, Analista
          &ldquo;A&rdquo; y Encargado de Presupuesto, Edwin Baudilio Fuentes Fuentes, Bodeguero &ldquo;A&rdquo;,
          Elesinda Gabriela Rodríguez Orozco, Secretaria &ldquo;A&rdquo; para dejar constancia de lo siguiente:{" "}
          <strong>PRIMERO:</strong> {nombreEncargadoUnidad}, da la bienvenida a todos los presentes y a
          continuación da a conocer la necesidad de adquisición de bienes y/o servicios necesarios para el
          servicio y buen funcionamiento de esta {nombreUnidad}, con el objeto de dar cumplimiento a la Ley de
          Contrataciones del Estado. <strong>SEGUNDO:</strong> Se procede a la comparación de ofertas recibidas,
          las cuales se detallan a continuación:
        </p>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt", margin: "8px 0" }}>
        <thead>
          <tr style={{ background: "#fde68a" }}>
            <th style={{ border: "1px solid #333", padding: "4px 8px", textAlign: "left" }}>OFERENTE</th>
            <th style={{ border: "1px solid #333", padding: "4px 8px", textAlign: "left" }}>NIT OFERENTE</th>
            <th style={{ border: "1px solid #333", padding: "4px 8px", textAlign: "right" }}>PRECIO OFERTADO</th>
          </tr>
        </thead>
        <tbody>
          {oferentes.map(o => (
            <tr key={o.id} style={{ background: "#fde68a" }}>
              <td style={{ border: "1px solid #333", padding: "4px 8px" }}>{o.nombre}</td>
              <td style={{ border: "1px solid #333", padding: "4px 8px", fontFamily: "monospace" }}>{o.nit}</td>
              <td style={{ border: "1px solid #333", padding: "4px 8px", textAlign: "right" }}>
                {Q(o.costo)} {o.exento_iva ? "(exento IVA)" : ""}
              </td>
            </tr>
          ))}
          {oferentes.length === 0 && (
            <tr><td colSpan={3} style={{ border: "1px solid #333", padding: "4px 8px", textAlign: "center", color: "#999" }}>Sin oferentes registrados</td></tr>
          )}
        </tbody>
      </table>

      <p style={{ fontSize: "9pt", textAlign: "justify", lineHeight: 1.4, margin: "8px 0 0 0" }}>
        {esCompraDirecta ? (
          <>
            <strong>TERCERO:</strong>{" "}
            <span style={{ background: "#fde68a" }}>{c.razon_adjudicacion || "—"}</span>. Dicha decisión se
            fundamenta en la Ley de Contrataciones del Estado, Decreto Número 57-92, artículo 43, inciso b), el
            cual cita: La modalidad de compra directa consiste en la adquisición de bienes, suministros, obras
            y servicios a través de una oferta electrónica en el sistema GUATECOMPRAS, prescindiendo de los
            procedimientos de licitación o cotización, cuando la adquisición sea por montos mayores a
            veinticinco mil Quetzales (Q.25,000.00) y que no supere los noventa mil Quetzales (Q.90,000.00).
            Asimismo, se alinea con el Acuerdo Número 22-2025 de la Gerencia del IGSS, de fecha 15 de julio de
            2025, cuyo artículo 1, segundo párrafo, reitera que la Compra Directa con oferta electrónica no
            debe superar los noventa mil Quetzales (Q.90,000.00), incluyendo el IVA, y con el artículo 30 del
            Reglamento de la Ley de Contrataciones del Estado (Acuerdo Gubernativo 1056-92), así como con
            normativa interna del Instituto. La adjudicación se otorga en base al criterio del precio y por
            cumplimiento en las bases, tanto como en las especificaciones técnicas solicitadas, y por convenir
            a los intereses del Instituto. <strong>CUARTO:</strong> No habiendo más que hacer constar, se da
            por finalizada la presente en el mismo lugar y fecha de su inicio, la que, leída en cada uno de
            sus puntos, la aceptamos, ratificamos y firmamos de conformidad las personas que en ella
            intervenimos. Damos fe.
          </>
        ) : c.cotizacion_anual_id ? (
          <><strong>TERCERO:</strong> Precios pactados según Cotización Anual No.{" "}
          <span style={{ background: "#fde68a" }}>{c.referencia || "—"}</span>.</>
        ) : (
          <><strong>TERCERO:</strong> Razonamiento de la adjudicación:{" "}
          <span style={{ background: "#fde68a" }}>{c.razon_adjudicacion || "—"}</span>.</>
        )}
      </p>
    </>
  );

  const cierre = (
    <>
      <p style={{ fontSize: "9pt", textAlign: "justify", lineHeight: 1.4, marginTop: "14px" }}>
        Y para remitir a donde corresponda, se extiende la presente copia Certificada, haciendo constar que fue
        debidamente confrontada con su original el día: {hoyTexto}.
      </p>

      {esCompraDirecta ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginTop: "48px", fontSize: "9pt", textAlign: "center" }}>
          {COMISION_COMPRA_DIRECTA.map(m => (
            <div key={m.nombre} style={{ borderTop: "1.5px solid #222", paddingTop: "6px" }}>
              <p style={{ margin: 0, fontWeight: "bold" }}>{m.nombre}</p>
              <p style={{ margin: 0, color: "#444" }}>{m.cargo}</p>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "48px", fontSize: "9pt", textAlign: "center" }}>
          <div style={{ borderTop: "1.5px solid #222", paddingTop: "6px" }}>
            <p style={{ margin: 0, fontWeight: "bold" }}>{nombreResponsable || "Bernon Raúl Miranda González"}</p>
            <p style={{ margin: 0, color: "#444" }}>Analista &ldquo;A&rdquo;/Encargado de Fondo Rotativo</p>
          </div>
          <div style={{ borderTop: "1.5px solid #222", paddingTop: "6px" }}>
            <p style={{ margin: 0, fontWeight: "bold" }}>Vo.Bo. {nombreEncargadoUnidad}</p>
            <p style={{ margin: 0, color: "#444" }}>{cargoEncargadoUnidad}</p>
            <p style={{ margin: 0, color: "#444" }}>IGSS/UIAADDM en el Municipio de {municipioNombre}, {dep}</p>
          </div>
        </div>
      )}

      <p style={{ textAlign: "center", fontSize: "8pt", color: "#666", marginTop: "24px" }}>{direccionUnidad}</p>
    </>
  );

  const [paginas, setPaginas] = useState(1);

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">
          Acta {acta.no_acta} · {paginas} {paginas === 1 ? "hoja" : "hojas"} tamaño Carta
        </span>
        {!esCompraDirecta && (
          <>
            <span className="text-gray-300">|</span>
            <SelectorFirmante label="Encargado(a) de Unidad" firmantes={firmantes} value={encargadoUnidad} onChange={setEncargadoUnidad} />
          </>
        )}
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <PrintPages sections={[cuerpo, cierre]} pageSize="letter" marginMm={12} onPageCount={setPaginas} />
    </>
  );
}
