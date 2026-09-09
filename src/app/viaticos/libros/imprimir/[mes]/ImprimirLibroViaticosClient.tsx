"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import PrintPages from "@/components/print-pages/PrintPages";
import { fechaGuatemala } from "@/lib/date-utils";
import type { MovimientoLibro } from "../../actions";

interface Props {
  mes: string; movimientos: MovimientoLibro[]; existenciaInicial: number; folio: string;
  nombreUnidad: string; municipio: string;
}

const FONT = "Arial, Helvetica, sans-serif";
const C = "#000";
// Fecha | Nombre | Nombramiento | Fecha Nombramiento | Utilizados | Anulados
// | Extraviados | Existencia | Del | Al | Valor Viáticos Q.
const COLS = ["8%", "19%", "10%", "10%", "7%", "7%", "7%", "8%", "6%", "6%", "12%"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function ColGroup() {
  return <colgroup>{COLS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>;
}

const TH: React.CSSProperties = { border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9", fontSize: "7.5pt" };
const TD: React.CSSProperties = { border: "1px solid #999", padding: "3px", fontSize: "8pt" };

export default function ImprimirLibroViaticosClient({ mes, movimientos, existenciaInicial, folio, nombreUnidad, municipio }: Props) {
  const router = useRouter();
  const [paginas, setPaginas] = useState(1);
  const [anio, mesNum] = mes.split("-").map(Number);
  const nombreMes = MESES[(mesNum ?? 1) - 1] ?? mes;
  const ultimoDia = new Date(anio, mesNum, 0).getDate();

  // Existencia corrida: arranca en existenciaInicial y cada movimiento la
  // ajusta en el mismo orden en que va a imprimirse.
  const filas = useMemo(() => {
    let existencia = existenciaInicial;
    return movimientos.map(m => {
      existencia = existencia - m.utilizados - m.anulados - m.extraviados + (m.cantidad_recepcion ?? 0);
      return { ...m, existencia };
    });
  }, [movimientos, existenciaInicial]);

  const totales = useMemo(() => ({
    utilizados: movimientos.reduce((s, m) => s + m.utilizados, 0),
    anulados: movimientos.reduce((s, m) => s + m.anulados, 0),
    extraviados: movimientos.reduce((s, m) => s + m.extraviados, 0),
    recibidos: movimientos.reduce((s, m) => s + (m.cantidad_recepcion ?? 0), 0),
    valor: movimientos.reduce((s, m) => s + (m.valor ?? 0), 0),
  }), [movimientos]);

  const saldoFinal = existenciaInicial + totales.recibidos - totales.utilizados - totales.anulados - totales.extraviados;

  const encabezado = (
    <div style={{ fontFamily: FONT, color: C }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold" }}>INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL</p>
          <p style={{ margin: "1px 0", fontSize: "8.5pt" }}>{nombreUnidad}</p>
          <p style={{ margin: "4px 0 0 0", fontSize: "9pt", fontWeight: "bold" }}>LIBRO DE CONTROL, EXISTENCIA, USO Y ENTREGA</p>
          <p style={{ margin: "1px 0", fontSize: "9pt", fontWeight: "bold" }}>FORMULARIOS DE VIÁTICO ANTICIPO, CONSTANCIA Y LIQUIDACIÓN</p>
          <p style={{ margin: "3px 0 0 0", fontSize: "8.5pt" }}>
            MOVIMIENTO CORRESPONDIENTE DEL 01 AL {ultimoDia} DE {nombreMes.toUpperCase()} DEL {anio}
          </p>
        </div>
        {folio && <p style={{ margin: 0, fontSize: "8.5pt", fontWeight: "bold", whiteSpace: "nowrap" }}>No. Folio: {folio}</p>}
      </div>
      <p style={{ textAlign: "right", fontSize: "8pt", margin: "6px 0 6px 0" }}>{municipio}, fecha de impresión: {fechaGuatemala()}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <ColGroup />
        <thead>
          <tr>
            <th style={TH} colSpan={4}>Comisión</th>
            <th style={TH} colSpan={6}>Entrega, uso y existencia de Formularios de Viáticos</th>
            <th style={TH}>Valor Viáticos Q.</th>
          </tr>
          <tr>
            <th style={TH}>Fecha</th>
            <th style={TH}>Nombre de Comisionado</th>
            <th style={TH}>Nombramiento</th>
            <th style={TH}>Fecha Nombramiento</th>
            <th style={TH}>Utilizados</th>
            <th style={TH}>Anulados</th>
            <th style={TH}>Extraviados</th>
            <th style={TH}>Existencia</th>
            <th style={TH}>Del</th>
            <th style={TH}>Al</th>
            <th style={TH}></th>
          </tr>
        </thead>
      </table>
    </div>
  );

  const filaExistenciaInicial = (
    <table key="existencia-inicial" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup />
      <tbody>
        <tr>
          <td style={{ ...TD, fontWeight: "bold" }} colSpan={7}>Existencia inicial</td>
          <td style={{ ...TD, textAlign: "center", fontFamily: "monospace", fontWeight: "bold" }}>{existenciaInicial}</td>
          <td style={TD} colSpan={2}></td>
          <td style={TD}></td>
        </tr>
      </tbody>
    </table>
  );

  const filaMovimiento = (m: (typeof filas)[number], i: number) => (
    <table key={i} style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup />
      <tbody>
        <tr>
          <td style={TD}>{fechaCorta(m.fecha)}</td>
          <td style={TD}>{m.nombre}</td>
          <td style={{ ...TD, textAlign: m.tipo === "recepcion" ? "center" : "left", fontFamily: m.tipo === "recepcion" ? "monospace" : undefined }}>
            {m.tipo === "recepcion" ? m.cantidad_recepcion : (m.nombramiento ?? "—")}
          </td>
          <td style={TD}>{m.tipo === "formulario" ? fechaCorta(m.fecha_nombramiento) : ""}</td>
          <td style={{ ...TD, textAlign: "center" }}>{m.utilizados > 0 ? m.utilizados : ""}</td>
          <td style={{ ...TD, textAlign: "center" }}>{m.anulados > 0 ? m.anulados : ""}</td>
          <td style={{ ...TD, textAlign: "center" }}>{m.extraviados > 0 ? m.extraviados : ""}</td>
          <td style={{ ...TD, textAlign: "center", fontFamily: "monospace" }}>{m.existencia}</td>
          <td style={{ ...TD, textAlign: "center", fontFamily: "monospace" }}>{m.numero_formulario ?? ""}</td>
          <td style={{ ...TD, textAlign: "center", fontFamily: "monospace" }}>{m.numero_formulario ?? ""}</td>
          <td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{m.valor != null ? `Q${m.valor.toLocaleString("es-GT", { minimumFractionDigits: 2 })}` : "-"}</td>
        </tr>
      </tbody>
    </table>
  );

  const filaTotales = (
    <table key="totales" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup />
      <tbody>
        <tr>
          <td style={{ ...TD, fontWeight: "bold", background: "#f1f5f9" }} colSpan={4}>Totales</td>
          <td style={{ ...TD, textAlign: "center", fontWeight: "bold" }}>{totales.utilizados}</td>
          <td style={{ ...TD, textAlign: "center", fontWeight: "bold" }}>{totales.anulados}</td>
          <td style={{ ...TD, textAlign: "center", fontWeight: "bold" }}>{totales.extraviados}</td>
          <td style={{ ...TD, fontWeight: "bold", background: "#f1f5f9" }} colSpan={3}>Total de Viáticos</td>
          <td style={{ ...TD, textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>
            Q{totales.valor.toLocaleString("es-GT", { minimumFractionDigits: 2 })}
          </td>
        </tr>
      </tbody>
    </table>
  );

  const resumen = (
    <table key="resumen" style={{ width: "60%", borderCollapse: "collapse", fontFamily: FONT, color: C, fontSize: "8.5pt", marginTop: "10px" }}>
      <tbody>
        <tr><td style={{ ...TD, fontWeight: "bold", background: "#f1f5f9" }} colSpan={2}>Resumen</td></tr>
        <tr><td style={TD}>Saldo inicial Formularios</td><td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{existenciaInicial}</td></tr>
        <tr><td style={TD}>(+) Recibidos por Depto. Tesorería</td><td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{totales.recibidos}</td></tr>
        <tr><td style={TD}>(-) Formularios Utilizados</td><td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{totales.utilizados}</td></tr>
        <tr><td style={TD}>(-) Formularios Anulados</td><td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{totales.anulados}</td></tr>
        <tr><td style={TD}>(-) Formularios Extraviados</td><td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{totales.extraviados}</td></tr>
        <tr><td style={{ ...TD, fontWeight: "bold" }}>Saldo Final</td><td style={{ ...TD, textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>{saldoFinal}</td></tr>
      </tbody>
    </table>
  );

  const firmas = (
    <div key="firmas" style={{ display: "flex", justifyContent: "space-between", marginTop: "36px", fontFamily: FONT, color: C, fontSize: "8.5pt" }}>
      <div style={{ textAlign: "center", width: "45%" }}>
        <div style={{ borderTop: "1px solid #000", paddingTop: "3px" }}>Nombre completo</div>
        <p style={{ margin: "2px 0 0 0" }}>Encargado de Viáticos o Fondo Rotativo Interno</p>
      </div>
      <div style={{ textAlign: "center", width: "45%" }}>
        <div style={{ borderTop: "1px solid #000", paddingTop: "3px" }}>Nombre completo</div>
        <p style={{ margin: "2px 0 0 0" }}>Máxima Autoridad de Unidad Administrativa</p>
      </div>
    </div>
  );

  const sections: React.ReactNode[] = [
    filaExistenciaInicial,
    ...(filas.length > 0 ? filas.map((m, i) => filaMovimiento(m, i)) : [
      <p key="sin-mov" style={{ fontFamily: FONT, color: C, fontSize: "8.5pt", padding: "6px 0" }}>Sin movimientos este mes.</p>,
    ]),
    filaTotales,
    resumen,
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
          Libro de Viáticos — {nombreMes} {anio} · {paginas} {paginas === 1 ? "hoja" : "hojas"} tamaño Carta
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
