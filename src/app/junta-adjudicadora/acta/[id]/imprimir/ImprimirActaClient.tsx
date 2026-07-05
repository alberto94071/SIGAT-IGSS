"use client";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import { deletrearCodigo, fechaEnLetras, horaEnLetras } from "@/lib/adjudicacion/deletreo";

type Acta = {
  id: number; no_formulario: string; no_acta: string; lugar: string; fecha: string; hora: string;
};
type Consolidacion = {
  id: number; numero: number; anio: number; tipo_compra: string | null;
  numero_adjudicacion: string | null; pre_orden: string | null;
};
type Oferente = { id: number; nit: string; nombre: string; costo: number; exento_iva: boolean };

interface Props {
  acta: Acta; consolidacion: Consolidacion; oferentes: Oferente[];
  nombreUnidad: string; municipio: string; direccionUnidad: string; nombreResponsable: string;
}

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ImprimirActaClient({
  acta, consolidacion: c, oferentes, nombreUnidad, municipio, direccionUnidad, nombreResponsable,
}: Props) {
  const router = useRouter();
  const [municipioNombre, departamento] = municipio.split(",").map(s => s.trim());
  const dep = departamento || "San Marcos";

  const fechaTexto = fechaEnLetras(acta.fecha);
  const horaTexto = horaEnLetras(acta.hora);
  const actaDeletreada = deletrearCodigo(acta.no_acta);
  const hoyTexto = fechaEnLetras(new Date().toISOString().slice(0, 10));

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">Acta {acta.no_acta}</span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div id="print-wrapper">
        <div id="a4-sheet">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <img src="/LOGO_SIAF01.svg" alt="IGSS" style={{ height: "40px", width: "auto" }} />
          </div>

          <p style={{ fontWeight: "bold", fontSize: "9.5pt", margin: "0 0 10px 0" }}>{nombreUnidad}</p>

          <p style={{ fontSize: "9.5pt", textAlign: "justify", lineHeight: 1.5, margin: "0 0 10px 0" }}>
            EL INFRASCRITO, ENCARGADO DEL FONDO ROTATIVO DE LA {nombreUnidad.toUpperCase()}, CERTIFICA: HABER TENIDO A
            LA VISTA LAS HOJAS MOVIBLES AUTORIZADAS POR LA CONTRALORÍA GENERAL DE CUENTAS DE {dep.toUpperCase()} CON
            REGISTRO NUMERO ELE GUION DOCE GUION CIENTO SESENTA Y SEIS GUION DOS MIL VEINTICINCO (L-12-166-2025) DE
            FECHA TREINTA Y UNO DE MARZO DE DOS MIL VEINTICINCO (31-03-2025), EN EL QUE A FOLIO NUMERO SEIS (6) SE
            ENCUENTRA EL ACTA NUMERO {actaDeletreada} ({acta.no_acta}), QUE LITERALMENTE DICE: {"- ".repeat(20)}
          </p>

          <p style={{ fontWeight: "bold", fontSize: "10.5pt", textAlign: "center", margin: "0 0 8px 0" }}>
            ACTA No. {acta.no_acta}
          </p>

          <p style={{ fontSize: "9.5pt", textAlign: "justify", lineHeight: 1.5 }}>
            En el Municipio de {acta.lugar || municipioNombre}, del Departamento de {dep}, siendo las {horaTexto} del
            día {fechaTexto}, reunidos en el local que ocupa la {nombreUnidad}, del Instituto Guatemalteco de
            Seguridad Social, las siguientes personas: Lilia Zucely Pérez Fuentes, Analista &ldquo;A&rdquo; con
            Funciones de Encargada de Unidad, {nombreResponsable || "Bernon Raúl Miranda González"}, Analista
            &ldquo;A&rdquo; y Encargado de Presupuesto, Edwin Baudilio Fuentes Fuentes, Bodeguero &ldquo;A&rdquo;,
            Elesinda Gabriela Rodríguez Orozco, Secretaria &ldquo;A&rdquo; para dejar constancia de lo siguiente:{" "}
            <strong>PRIMERO:</strong> La Licenciada Lilia Pérez, da la bienvenida a todos los presentes y a
            continuación da a conocer la necesidad de adquisición de bienes y/o servicios necesarios para el
            servicio y buen funcionamiento de esta {nombreUnidad}, con el objeto de dar cumplimiento a la Ley de
            Contrataciones del Estado. <strong>SEGUNDO:</strong> Se procede a la comparación de ofertas recibidas,
            las cuales se detallan a continuación:
          </p>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt", margin: "10px 0" }}>
            <thead>
              <tr style={{ background: "#fde68a" }}>
                <th style={{ border: "1px solid #333", padding: "5px 8px", textAlign: "left" }}>OFERENTE</th>
                <th style={{ border: "1px solid #333", padding: "5px 8px", textAlign: "left" }}>NIT OFERENTE</th>
                <th style={{ border: "1px solid #333", padding: "5px 8px", textAlign: "right" }}>PRECIO OFERTADO</th>
              </tr>
            </thead>
            <tbody>
              {oferentes.map(o => (
                <tr key={o.id} style={{ background: "#fde68a" }}>
                  <td style={{ border: "1px solid #333", padding: "5px 8px" }}>{o.nombre}</td>
                  <td style={{ border: "1px solid #333", padding: "5px 8px", fontFamily: "monospace" }}>{o.nit}</td>
                  <td style={{ border: "1px solid #333", padding: "5px 8px", textAlign: "right" }}>
                    {Q(o.costo)} {o.exento_iva ? "(exento IVA)" : ""}
                  </td>
                </tr>
              ))}
              {oferentes.length === 0 && (
                <tr><td colSpan={3} style={{ border: "1px solid #333", padding: "5px 8px", textAlign: "center", color: "#999" }}>Sin oferentes registrados</td></tr>
              )}
            </tbody>
          </table>

          <p style={{ fontSize: "9.5pt", textAlign: "justify", lineHeight: 1.5, margin: "10px 0" }}>
            <strong>TERCERO:</strong> Razonamiento de la adjudicación:{" "}
            <span style={{ background: "#fde68a" }}>{c.numero_adjudicacion || "—"}</span>.
          </p>

          <p style={{ fontSize: "9pt", textAlign: "justify", lineHeight: 1.5, marginTop: "20px" }}>
            Y para remitir a donde corresponda, se extiende la presente copia Certificada, haciendo constar que fue
            debidamente confrontada con su original el día: {hoyTexto}.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "70px", fontSize: "9pt", textAlign: "center" }}>
            <div style={{ borderTop: "1.5px solid #222", paddingTop: "6px" }}>
              <p style={{ margin: 0, fontWeight: "bold" }}>{nombreResponsable || "Bernon Raúl Miranda González"}</p>
              <p style={{ margin: 0, color: "#444" }}>Analista &ldquo;A&rdquo;/Encargado de Fondo Rotativo</p>
            </div>
            <div style={{ borderTop: "1.5px solid #222", paddingTop: "6px" }}>
              <p style={{ margin: 0, fontWeight: "bold" }}>Vo.Bo. Licda. Lilia Zucely Pérez Fuentes</p>
              <p style={{ margin: 0, color: "#444" }}>Analista &ldquo;A&rdquo;/Encargada de Unidad</p>
              <p style={{ margin: 0, color: "#444" }}>IGSS/UIAADDM en el Municipio de {municipioNombre}, {dep}</p>
            </div>
          </div>

          <p style={{ textAlign: "center", fontSize: "8pt", color: "#666", marginTop: "40px" }}>{direccionUnidad}</p>
        </div>
      </div>

      <style>{`
        #print-wrapper {
          background: #94a3b8; display: flex; justify-content: center; align-items: flex-start;
          padding: 40px 20px; min-height: 100vh; margin-top: 52px; box-sizing: border-box;
        }
        #a4-sheet {
          background: white; width: 210mm; min-height: 297mm; box-shadow: 0 4px 32px rgba(0,0,0,0.22);
          padding: 18mm 16mm; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; color: #000;
        }
        .no-print { display: block; }
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          .no-print { display: none !important; }
          #print-wrapper { background: white !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; display: block !important; }
          #a4-sheet { width: 100% !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
        }
      `}</style>
    </>
  );
}
