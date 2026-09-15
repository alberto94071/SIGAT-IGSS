"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import PrintPages from "@/components/print-pages/PrintPages";
import { fechaGuatemala } from "@/lib/date-utils";
import type { MovimientoCajaChica } from "@/lib/caja-chica-liquidacion-actions";

interface Props {
  mes: string; movimientos: MovimientoCajaChica[]; saldoInicial: number;
  nombreUnidad: string; municipio: string;
}

const Q = (n: number) => n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FONT = "Arial, Helvetica, sans-serif";
const C = "#000";
// Aproximado a ojo contra el modelo que mandó el cliente (MODELO_LIBRO_CAJA_CHICA.pdf)
// — barra de título azul oscuro, encabezado de tabla verde oliva oscuro.
const AZUL_TITULO = "#1F4E79";
const VERDE_HEADER = "#4A5A2A";
const COLS = ["9%", "11%", "9%", "17%", "26%", "10%", "10%", "8%"];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CAP = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
  "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function ultimoDiaDelMes(anio: number, mesNum: number): number {
  return new Date(anio, mesNum, 0).getDate();
}
function ColGroup() {
  return <colgroup>{COLS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>;
}

export default function ImprimirLibroCajaChicaClient({ mes, movimientos, saldoInicial, nombreUnidad, municipio }: Props) {
  const router = useRouter();
  const [paginas, setPaginas] = useState(1);
  const [anio, mesNum] = mes.split("-").map(Number);
  const nombreMes = MESES[(mesNum ?? 1) - 1] ?? mes;
  const nombreMesCap = MESES_CAP[(mesNum ?? 1) - 1] ?? mes;
  const ultimoDia = ultimoDiaDelMes(anio, mesNum);

  const totalCredito = movimientos.reduce((s, m) => s + m.credito, 0);
  const totalDebito = movimientos.reduce((s, m) => s + m.debito, 0);
  const saldoFinal = movimientos.length > 0 ? movimientos[movimientos.length - 1].saldo : saldoInicial;

  const encabezado = (
    <div style={{ fontFamily: FONT, color: C }}>
      <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold" }}>INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL</p>
      <p style={{ margin: "1px 0 8px 0", fontSize: "8.5pt" }}>{nombreUnidad}</p>
      <p style={{ textAlign: "right", fontSize: "8pt", margin: "0 0 6px 0" }}>{municipio}, fecha de impresión: {fechaGuatemala()}</p>
      <div style={{ background: AZUL_TITULO, color: "#fff", padding: "5px 8px", fontWeight: "bold", fontSize: "9pt", textAlign: "center" }}>
        Movimiento correspondiente del 1 al {ultimoDia} de {nombreMesCap} de {anio}
      </div>
      <p style={{ textAlign: "center", fontSize: "7.5pt", margin: "3px 0 6px 0" }}>Cifras expresadas en Quetzales</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "7.5pt", tableLayout: "fixed" }}>
        <ColGroup />
        <thead>
          <tr>
            {["Fecha", "Tipo de Documento", "No. Documento", "Beneficiario", "Descripción del Desembolso", "Crédito", "Debito", "Saldo"].map(h => (
              <th key={h} style={{ border: "1px solid #999", padding: "4px 3px", background: VERDE_HEADER, color: "#fff" }}>{h}</th>
            ))}
          </tr>
        </thead>
      </table>
    </div>
  );

  const fila = (m: MovimientoCajaChica) => (
    <table key={m.id} style={{ width: "100%", borderCollapse: "collapse", fontSize: "7.5pt", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup />
      <tbody>
        <tr>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{m.fecha || "—"}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{m.tipoDocumento}</td>
          <td style={{ border: "1px solid #999", padding: "3px", fontFamily: "monospace" }}>{m.numeroDocumento}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{m.beneficiario}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{m.descripcion}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>{m.credito > 0 ? `Q ${Q(m.credito)}` : ""}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>{m.debito > 0 ? `Q ${Q(m.debito)}` : ""}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>Q {Q(m.saldo)}</td>
        </tr>
      </tbody>
    </table>
  );

  const totales = (
    <table key="totales" style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", tableLayout: "fixed", fontFamily: FONT, color: C, marginTop: "4px" }}>
      <ColGroup />
      <tbody>
        <tr>
          <td colSpan={4} style={{ border: "1px solid #999", padding: "4px 3px", fontWeight: "bold", background: "#f1f5f9" }}>Saldo inicial del mes</td>
          <td colSpan={3} style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }} />
          <td style={{ border: "1px solid #999", padding: "4px 3px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>Q {Q(saldoInicial)}</td>
        </tr>
        <tr>
          <td colSpan={5} style={{ border: "1px solid #999", padding: "4px 3px", fontWeight: "bold", background: "#f1f5f9" }}>Totales del mes</td>
          <td style={{ border: "1px solid #999", padding: "4px 3px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>Q {Q(totalCredito)}</td>
          <td style={{ border: "1px solid #999", padding: "4px 3px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>Q {Q(totalDebito)}</td>
          <td style={{ border: "1px solid #999", padding: "4px 3px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>Q {Q(saldoFinal)}</td>
        </tr>
      </tbody>
    </table>
  );

  const firmas = (
    <div key="firmas" style={{ display: "flex", justifyContent: "space-between", marginTop: "36px", fontFamily: FONT, color: C, fontSize: "8.5pt" }}>
      <div style={{ textAlign: "center", width: "45%" }}>
        <div style={{ borderTop: "1px solid #000", paddingTop: "3px" }}>Nombre completo</div>
        <p style={{ margin: "2px 0 0 0" }}>Analista &quot;A&quot;/Encargado de Fondo Rotativo</p>
      </div>
      <div style={{ textAlign: "center", width: "45%" }}>
        <div style={{ borderTop: "1px solid #000", paddingTop: "3px" }}>Vo.Bo. Nombre completo</div>
        <p style={{ margin: "2px 0 0 0" }}>Analista &quot;A&quot;/Encargada de Unidad</p>
      </div>
    </div>
  );

  const sections: React.ReactNode[] = [
    ...(movimientos.length > 0
      ? movimientos.map(m => fila(m))
      : [<p key="sin-mov" style={{ fontFamily: FONT, color: C, fontSize: "8.5pt", padding: "6px 0" }}>Sin movimientos este mes.</p>]),
    totales,
    firmas,
  ];

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">
          Libro Caja Chica — {nombreMes} {anio} · {paginas} {paginas === 1 ? "hoja" : "hojas"} tamaño Carta
        </span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <PrintPages sections={sections} headerSections={[encabezado]} pageSize="letter" landscape marginMm={12} onPageCount={setPaginas} />
    </>
  );
}
