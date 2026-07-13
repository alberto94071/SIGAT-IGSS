"use client";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";

type Consolidacion = {
  id: number; numero: number; anio: number; fecha: string;
  numero_adjudicacion: string | null; pre_orden: string | null;
  proveedor_nombre: string | null; proveedor_nit: string | null;
  total: number | null; numero_cheque: string | null; exento_iva: boolean;
};

interface Props { consolidacion: Consolidacion; nombreUnidad: string; direccionUnidad: string; }

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ConformidadClient({ consolidacion: c, nombreUnidad, direccionUnidad }: Props) {
  const router = useRouter();
  const correlativo = c.numero_adjudicacion ? `ADJ-${c.numero_adjudicacion}` : c.pre_orden ? `PRE-${c.pre_orden}` : `${c.numero}/${c.anio}`;
  const hoy = new Date().toLocaleDateString("es-GT", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">Carta de Conformidad — {correlativo}</span>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div id="print-wrapper">
        <div id="a4-sheet">
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <p style={{ fontWeight: "bold", fontSize: "13pt", margin: 0 }}>CARTA DE CONFORMIDAD</p>
            <p style={{ fontSize: "10pt", margin: "4px 0 0 0", color: "#444" }}>{nombreUnidad}</p>
          </div>

          <p style={{ fontSize: "10.5pt", margin: "0 0 20px 0" }}>Tacaná, San Marcos, {hoy}</p>

          <div style={{ fontSize: "10.5pt", lineHeight: 1.7, textAlign: "justify" }}>
            <p>
              Por este medio se hace constar la conformidad respecto a la compra identificada con el
              correlativo <strong>{correlativo}</strong>, adquirida al proveedor{" "}
              <strong>{c.proveedor_nombre ?? "—"}</strong>
              {c.proveedor_nit && <> (NIT: {c.proveedor_nit})</>}, por un monto total de{" "}
              <strong>{c.total != null ? Q(c.total) : "—"}</strong>
              {" "}({c.exento_iva ? "exento de IVA" : "IVA incluido"})
              {c.numero_cheque && <>, cancelado mediante cheque número <strong>{c.numero_cheque}</strong></>}.
            </p>
            <p style={{ marginTop: "12px" }}>
              Se deja constancia de que el bien o servicio fue recibido a entera satisfacción, conforme a lo
              solicitado y en las condiciones pactadas.
            </p>
          </div>

          <div style={{ marginTop: "70px", display: "flex", justifyContent: "center" }}>
            <div style={{ width: "260px", borderTop: "1.5px solid #222", paddingTop: "6px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "9pt" }}>Firma responsable</p>
            </div>
          </div>

          <p style={{ marginTop: "40px", fontSize: "8pt", color: "#666" }}>{direccionUnidad}</p>
        </div>
      </div>

      <style>{`
        #print-wrapper {
          background: #94a3b8; display: flex; justify-content: center; align-items: flex-start;
          padding: 40px 20px; min-height: 100vh; margin-top: 52px; box-sizing: border-box;
        }
        #a4-sheet {
          background: white; width: 210mm; min-height: 297mm; box-shadow: 0 4px 32px rgba(0,0,0,0.22);
          padding: 20mm 18mm; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; color: #000;
        }
        .no-print { display: block; }
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          .no-print { display: none !important; }
          #print-wrapper { background: white !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; display: block !important; }
          #a4-sheet { width: 100% !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
        }
      `}</style>
    </>
  );
}
