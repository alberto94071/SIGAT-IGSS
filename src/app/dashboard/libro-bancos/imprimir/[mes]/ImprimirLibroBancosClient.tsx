"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import PrintPages from "@/components/print-pages/PrintPages";
import { fechaGuatemala } from "@/lib/date-utils";
import type { MovimientoBancoTotal } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";

interface Props {
  mes: string; movimientos: MovimientoBancoTotal[]; saldoAnterior: number;
  nombreUnidad: string; municipio: string;
}

const Q = (n: number) => n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FONT = "Arial, Helvetica, sans-serif";
const C = "#000";
// Mismos colores que Libro Caja Chica (calibrados contra su modelo real) —
// este Libro Bancos usa el mismo estilo de barra de título azul oscuro y
// encabezado verde oliva oscuro, confirmado también en MODELO_LIBRO_
// BANCOS.pdf.
const AZUL_TITULO = "#1F4E79";
const VERDE_HEADER = "#4A5A2A";
const COLS = ["8%", "9%", "8%", "14%", "27%", "8%", "9%", "9%", "8%"];

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

// Input "en blanco para llenar" — mismo criterio que el resto de campos
// editables antes de imprimir en este sistema (se llena en pantalla, el
// navegador lo imprime tal cual, no persiste en la base).
function InputMonto({ value, onChange, bold }: { value: string; onChange: (v: string) => void; bold?: boolean }) {
  return (
    <input
      value={value} onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", border: "none", borderBottom: "1px solid #999", textAlign: "right",
        fontFamily: "monospace", fontSize: "8pt", fontWeight: bold ? "bold" : "normal",
        background: "transparent", padding: "1px 2px",
      }}
    />
  );
}

export default function ImprimirLibroBancosClient({ mes, movimientos, saldoAnterior, nombreUnidad, municipio }: Props) {
  const router = useRouter();
  const [paginas, setPaginas] = useState(1);
  const [anio, mesNum] = mes.split("-").map(Number);
  const nombreMesCap = MESES_CAP[(mesNum ?? 1) - 1] ?? mes;
  const ultimoDia = ultimoDiaDelMes(anio, mesNum);

  const totalCredito = movimientos.reduce((s, m) => s + m.ingresos, 0);
  const totalDebito = movimientos.reduce((s, m) => s + m.egresos, 0);
  const saldoFinal = movimientos.length > 0 ? movimientos[movimientos.length - 1].saldo : saldoAnterior;

  // "Resumen de libro de bancos" — desglose del mismo total, no un dato
  // aparte: Depósitos = créditos de tipo "Depósito" (constitución/remanente/
  // reintegro); Cheques emitidos = débitos de todo lo demás (Vale/Factura/
  // Formulario), tal cual quedó registrado (incluye lo de un cheque Anulado,
  // que nunca salió del banco de verdad); Cheques anulados lo vuelve a sumar
  // para cancelar esa resta — así el "Saldo final conciliado" de esta
  // sección sí excluye cheques anulados, aunque el saldo corrido de la
  // tabla de arriba (a propósito) no lo hace — ver el comentario de
  // MovimientoBancoTotal.status en fondo-rotativo-pagos-actions.ts.
  const depositos = movimientos.filter(m => m.tipoDocumento === "Depósito").reduce((s, m) => s + m.ingresos, 0);
  const chequesAnulados = movimientos.filter(m => m.status === "Anulado").reduce((s, m) => s + m.egresos, 0);
  const chequesEmitidos = movimientos.filter(m => m.tipoDocumento !== "Depósito").reduce((s, m) => s + m.egresos, 0);
  const saldoFinalResumen = saldoAnterior + depositos + chequesAnulados - chequesEmitidos;

  // "Cheques en circulación" (Conciliación) — cheques que este Libro ya
  // registró como emitidos pero que el banco todavía no procesó (status
  // "Operado", no "Pagado" todavía) al cierre del mes. Se sugiere solo, el
  // encargado lo ajusta contra el estado de cuenta real antes de imprimir.
  const chequesOperadosMes = useMemo(
    () => movimientos.filter(m => m.tipoDocumento !== "Depósito" && m.status === "Operado"),
    [movimientos],
  );
  const [circulacionNos, setCirculacionNos] = useState(
    () => chequesOperadosMes.map(m => m.numeroCheque).filter(Boolean).join(", "),
  );
  const [circulacionMonto, setCirculacionMonto] = useState(
    () => chequesOperadosMes.reduce((s, m) => s + m.egresos, 0).toFixed(2),
  );
  const [saldoEstadoCuenta, setSaldoEstadoCuenta] = useState("");
  // Mientras no se llene el saldo real del estado de cuenta, no tiene
  // sentido mostrar un "conciliado" calculado sobre 0 (saldría negativo) —
  // se deja en blanco hasta que el encargado lo complete.
  const saldoConciliado = saldoEstadoCuenta.trim() === "" ? null : (Number(saldoEstadoCuenta) || 0) - (Number(circulacionMonto) || 0);

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
            {["Fecha", "Tipo de Documento", "No. Documento", "Beneficiario", "Descripción", "Estado", "Crédito", "Débito", "Saldo"].map(h => (
              <th key={h} style={{ border: "1px solid #999", padding: "4px 3px", background: VERDE_HEADER, color: "#fff" }}>{h}</th>
            ))}
          </tr>
        </thead>
      </table>
    </div>
  );

  const fila = (m: MovimientoBancoTotal) => (
    <table key={m.id} style={{ width: "100%", borderCollapse: "collapse", fontSize: "7.5pt", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup />
      <tbody>
        <tr>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{m.fecha || "—"}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{m.tipoDocumento}</td>
          <td style={{ border: "1px solid #999", padding: "3px", fontFamily: "monospace" }}>{m.numeroCheque ?? "—"}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{m.beneficiario ?? "—"}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{m.descripcion}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{m.status}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>{m.ingresos > 0 ? `Q ${Q(m.ingresos)}` : ""}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>{m.egresos > 0 ? `Q ${Q(m.egresos)}` : ""}</td>
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
          <td colSpan={6} style={{ border: "1px solid #999", padding: "4px 3px", fontWeight: "bold", background: "#f1f5f9", textAlign: "right" }}>
            Saldo al {ultimoDia} de {nombreMesCap} de {anio}
          </td>
          <td style={{ border: "1px solid #999", padding: "4px 3px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold", background: "#f1f5f9" }}>Q {Q(totalCredito)}</td>
          <td style={{ border: "1px solid #999", padding: "4px 3px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold", background: "#f1f5f9" }}>Q {Q(totalDebito)}</td>
          <td style={{ border: "1px solid #999", padding: "4px 3px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold", background: "#f1f5f9" }}>Q {Q(saldoFinal)}</td>
        </tr>
      </tbody>
    </table>
  );

  function filaSeccion(label: string, celda: React.ReactNode, bold = false) {
    return (
      <tr key={label}>
        <td style={{ border: "1px solid #999", padding: "4px 6px", fontWeight: bold ? "bold" : "normal" }}>{label}</td>
        <td style={{ border: "1px solid #999", padding: "4px 6px", width: "18%", textAlign: "right", fontFamily: "monospace", fontWeight: bold ? "bold" : "normal" }}>
          {celda}
        </td>
      </tr>
    );
  }

  const conciliacion = (
    <div key="conciliacion" style={{ marginTop: "10px", fontFamily: FONT, color: C, fontSize: "8pt" }}>
      <div style={{ background: VERDE_HEADER, color: "#fff", padding: "4px 6px", fontWeight: "bold", textAlign: "center" }}>
        Conciliación del estado de cuenta monetaria
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {filaSeccion(
            `Saldo final según estado de cuenta al ${ultimoDia} de ${nombreMesCap} de ${anio}`,
            <>Q <InputMonto value={saldoEstadoCuenta} onChange={setSaldoEstadoCuenta} /></>,
          )}
          <tr>
            <td style={{ border: "1px solid #999", padding: "4px 6px" }}>
              (-) Integración de cheques en circulación Nos.{" "}
              <input value={circulacionNos} onChange={e => setCirculacionNos(e.target.value)}
                style={{ border: "none", borderBottom: "1px solid #999", background: "transparent", fontSize: "8pt", width: "55%" }} />
            </td>
            <td style={{ border: "1px solid #999", padding: "4px 6px", width: "18%", textAlign: "right", fontFamily: "monospace" }}>
              Q <InputMonto value={circulacionMonto} onChange={setCirculacionMonto} />
            </td>
          </tr>
          {filaSeccion("Saldo final conciliado", saldoConciliado != null ? `Q ${Q(saldoConciliado)}` : "Q —", true)}
        </tbody>
      </table>
    </div>
  );

  const resumen = (
    <div key="resumen" style={{ marginTop: "10px", fontFamily: FONT, color: C, fontSize: "8pt" }}>
      <div style={{ background: VERDE_HEADER, color: "#fff", padding: "4px 6px", fontWeight: "bold", textAlign: "center" }}>
        Resumen de libro de bancos
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {filaSeccion("Saldo inicial del libro de banco", `Q ${Q(saldoAnterior)}`)}
          {filaSeccion("(+) Depósitos", `Q ${Q(depositos)}`)}
          {filaSeccion("(+) Notas de Crédito", "Q 0.00")}
          {filaSeccion("(+) Cheques anulados", `Q ${Q(chequesAnulados)}`)}
          {filaSeccion("(-) Cheques emitidos", `Q ${Q(chequesEmitidos)}`)}
          {filaSeccion("(-) Notas de débito", "Q 0.00")}
          {filaSeccion("Saldo final conciliado", `Q ${Q(saldoFinalResumen)}`, true)}
        </tbody>
      </table>
    </div>
  );

  const firmas = (
    <div key="firmas" style={{ display: "flex", justifyContent: "space-between", marginTop: "30px", fontFamily: FONT, color: C, fontSize: "8pt" }}>
      <div style={{ textAlign: "center", width: "45%" }}>
        <div style={{ borderTop: "1px solid #000", paddingTop: "3px" }}>Nombre completo</div>
        <p style={{ margin: "2px 0 0 0" }}>Analista &quot;A&quot;/Encargado de Fondo Rotativo Interno</p>
        <p style={{ margin: 0 }}>IGSS-U.I.A.A.D.D.M. En el Municipio de Tejutla</p>
      </div>
      <div style={{ textAlign: "center", width: "45%" }}>
        <div style={{ borderTop: "1px solid #000", paddingTop: "3px" }}>Vo.Bo. Nombre completo</div>
        <p style={{ margin: "2px 0 0 0" }}>Analista &quot;A&quot;/Encargada de Unidad</p>
        <p style={{ margin: 0 }}>IGSS-U.I.A.A.D.D.M. En el Municipio de Tejutla</p>
      </div>
    </div>
  );

  const sections: React.ReactNode[] = [
    ...(movimientos.length > 0
      ? movimientos.map(m => fila(m))
      : [<p key="sin-mov" style={{ fontFamily: FONT, color: C, fontSize: "8.5pt", padding: "6px 0" }}>Sin movimientos este mes.</p>]),
    totales,
    conciliacion,
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
          Libro Bancos — {MESES[(mesNum ?? 1) - 1] ?? mes} {anio} · {paginas} {paginas === 1 ? "hoja" : "hojas"} tamaño Carta
        </span>
        <span className="text-xs text-gray-400">
          Completá "Saldo según estado de cuenta" y "Cheques en circulación" contra tu estado de cuenta real antes de imprimir.
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
