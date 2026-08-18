"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import PrintPages from "@/components/print-pages/PrintPages";
import SelectorFirmante, { type Firmante } from "@/components/SelectorFirmante";
import { fechaGuatemala } from "@/lib/date-utils";
import type { ModificacionRow, TransferenciaRow } from "@/lib/programacion-actions";

interface Props {
  modificaciones: ModificacionRow[];
  transferencias: TransferenciaRow[];
  nombreUnidad: string;
  firmantes: Firmante[];
}

const Q = (n: number) => n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FONT = "Arial, Helvetica, sans-serif";
const C = "#000";
const COLS_MOD = ["10%", "24%", "22%", "22%", "22%"];
const COLS_TRA = ["10%", "18%", "18%", "18%", "18%", "18%"];

function ColGroup({ cols }: { cols: string[] }) {
  return <colgroup>{cols.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>;
}

export default function ImprimirModificacionesClient({
  modificaciones, transferencias, nombreUnidad, firmantes,
}: Props) {
  const router = useRouter();
  const [paginas, setPaginas] = useState(1);
  const [firmante, setFirmante] = useState<Firmante | null>(null);
  const nombreEncargado = firmante?.nombre ?? "___________________________";
  const cargoEncargado = firmante?.cargo ?? "Encargado(a) de Unidad";

  const encabezado = (
    <div style={{ fontFamily: FONT, color: C }}>
      <p style={{ margin: 0, fontSize: "10pt", fontWeight: "bold" }}>INSTITUTO GUATEMALTECO DE SEGURIDAD SOCIAL</p>
      <p style={{ margin: "1px 0 10px 0", fontSize: "8.5pt" }}>{nombreUnidad}</p>
      <h1 style={{ textAlign: "center", fontSize: "12pt", fontWeight: "bold", margin: "10px 0", textTransform: "uppercase" }}>
        Formato de Modificaciones Presupuestarias
      </h1>
      <p style={{ textAlign: "right", fontSize: "8.5pt", margin: "0 0 8px 0" }}>Fecha de impresión: {fechaGuatemala()}</p>
    </div>
  );

  const tituloModificaciones = (
    <div style={{ fontFamily: FONT, color: C }}>
      <p style={{ fontSize: "9.5pt", fontWeight: "bold", margin: "6px 0" }}>Ingru / Ampliación</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", tableLayout: "fixed" }}>
        <ColGroup cols={COLS_MOD} />
        <thead>
          <tr>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Renglón</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Descripción</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Sub-Producto</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Tipo</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Valor</th>
          </tr>
        </thead>
      </table>
    </div>
  );

  const filaModificacion = (m: ModificacionRow) => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup cols={COLS_MOD} />
      <tbody>
        <tr>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{m.renglon}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{m.descripcion}</td>
          <td style={{ border: "1px solid #999", padding: "3px", fontFamily: "monospace" }}>{m.subProducto}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{m.tipo === "ingru" ? "Ingru" : "Ampliación"}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>{Q(m.valor)}</td>
        </tr>
      </tbody>
    </table>
  );

  const tituloTransferencias = (
    <div style={{ fontFamily: FONT, color: C }}>
      <p style={{ fontSize: "9.5pt", fontWeight: "bold", margin: "12px 0 6px 0" }}>Transferencias entre renglón/sub-producto</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", tableLayout: "fixed" }}>
        <ColGroup cols={COLS_TRA} />
        <thead>
          <tr>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Fecha</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Origen</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Destino</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Monto</th>
            <th style={{ border: "1px solid #999", padding: "4px 3px", background: "#f1f5f9" }}>Motivo</th>
          </tr>
        </thead>
      </table>
    </div>
  );

  const filaTransferencia = (t: TransferenciaRow) => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", tableLayout: "fixed", fontFamily: FONT, color: C }}>
      <ColGroup cols={COLS_TRA} />
      <tbody>
        <tr>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{t.fecha}</td>
          <td style={{ border: "1px solid #999", padding: "3px", fontFamily: "monospace" }}>{t.renglonOrigen}/{t.subProductoOrigen}</td>
          <td style={{ border: "1px solid #999", padding: "3px", fontFamily: "monospace" }}>{t.renglonDestino}/{t.subProductoDestino}</td>
          <td style={{ border: "1px solid #999", padding: "3px", textAlign: "right", fontFamily: "monospace" }}>{Q(t.monto)}</td>
          <td style={{ border: "1px solid #999", padding: "3px" }}>{t.motivo ?? "—"}</td>
        </tr>
      </tbody>
    </table>
  );

  const cierre = (
    <div style={{ textAlign: "center", marginTop: "50px", fontSize: "9pt", fontFamily: FONT, color: C }}>
      <div style={{ borderBottom: "1px solid #000", width: "260px", margin: "0 auto 4px auto", height: "30px" }} />
      <p style={{ margin: 0, fontWeight: "bold" }}>{nombreEncargado}</p>
      <p style={{ margin: 0, color: "#555" }}>{cargoEncargado}</p>
    </div>
  );

  const sections: React.ReactNode[] = [
    tituloModificaciones,
    ...(modificaciones.length > 0
      ? modificaciones.map(m => filaModificacion(m))
      : [<p key="sin-mod" style={{ fontFamily: FONT, color: C, fontSize: "8.5pt", padding: "6px 0" }}>Sin modificaciones Ingru/Ampliación registradas.</p>]),
    tituloTransferencias,
    ...(transferencias.length > 0
      ? transferencias.map(t => filaTransferencia(t))
      : [<p key="sin-tra" style={{ fontFamily: FONT, color: C, fontSize: "8.5pt", padding: "6px 0" }}>Sin transferencias registradas.</p>]),
    cierre,
  ];

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">
          Modificaciones · {paginas} {paginas === 1 ? "hoja" : "hojas"} tamaño Carta
        </span>
        <span className="text-gray-300">|</span>
        <SelectorFirmante label="Encargado(a)" firmantes={firmantes} value={firmante} onChange={setFirmante} />
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <PrintPages sections={sections} headerSections={[encabezado]} pageSize="letter" marginMm={12} onPageCount={setPaginas} />
    </>
  );
}
