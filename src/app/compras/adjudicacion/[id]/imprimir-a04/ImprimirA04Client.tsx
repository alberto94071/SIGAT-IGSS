"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft, ChevronDown, X } from "lucide-react";
import { montoIva } from "@/lib/iva-utils";
import { PRESUPUESTO_DATA } from "@/lib/presupuesto-general-data";

// Nombre oficial del renglón (ej. 113 → "TELEFONÍA") para la línea en
// negrita de la Descripción — mismo criterio que el A-04 SIAF real del
// IGSS, que separa la categoría del renglón (negrita) del detalle propio
// del insumo (texto normal) debajo.
const NOMBRE_RENGLON = new Map(PRESUPUESTO_DATA.map(r => [r.renglon, r.descripcion]));

type Consolidacion = {
  id: number; tipo_compra: string | null;
  proveedor_nombre: string | null; proveedor_nit: string | null;
  proveedor_direccion: string | null; proveedor_telefono: string | null;
  total: number | null; monto_bruto: number | null; exento_iva: boolean;
  numero_a04: number | null; anio_a04: number | null; a04_fecha: string | null;
  a04_dte_numero: string | null; a04_dte_serie: string | null; a04_dte_fecha: string | null;
  a04_no_pedido: string | null; a04_descripcion: string | null;
  a04_unidad_medida: string | null; a04_cantidad: number | null;
};
type Renglon = {
  renglon: number | null; codigo_igss: string | null; codigo_ppr: string | null; nombre: string;
  cantidad: number; total: number; unidad_medida: string | null;
};
type Firmante = { id: number; nombre: string; cargo: string; unidad: string | null };

interface Props {
  consolidacion: Consolidacion;
  renglones: Renglon[];
  nombreUnidad: string; codigoUnidad: string;
  direccionUnidad: string; municipio: string;
  todosFirmantes: Firmante[]; firmantesSeleccionados: Firmante[];
}

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const FONT = "Arial, Helvetica, sans-serif";
const B = "2px solid #1a1a1a";
const TB = "2px solid #000";
const R = "16px";
const C = "#000";

// Defensa contra código PPR guardado con un "-null" colgado (dato viejo de
// antes de que la selección de PPR sin código real usara el id de Base de
// Datos Central en vez del código_ppr crudo) — mejor mostrar "—" que
// imprimir literalmente la palabra "null" en un documento oficial. Cuando
// el insumo no tiene código real (codigo_igss = "S/C") y tampoco se le
// asignó PPR, la Forma A-04 SIAF real imprime "S-C" en esa columna en vez
// de dejarla en blanco.
function codigoPprMostrar(codigoPpr: string | null | undefined, codigoIgss: string | null | undefined): string {
  const s = codigoPpr?.trim();
  if (s && !/-?null$/i.test(s)) return s;
  return codigoIgss?.trim() === "S/C" ? "S-C" : "—";
}

const METODOS = ["Baja Cuantía", "Compra Directa", "Contrato Abierto", "Casos de Excepción"] as const;
const METODO_LABEL: Record<string, string> = {
  "Baja Cuantía": "BAJA CUANTÍA", "Compra Directa": "COMPRA DIRECTA",
  "Contrato Abierto": "CONTRATO ABIERTO", "Casos de Excepción": "CASOS DE EXCEPCIÓN",
};

const FIRMA_SLOTS = ["Encargado de Fondo Rotativo", "Analista de Presupuesto", "Director \"C\""] as const;

function Radio({ marcado }: { marcado: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: "13px", height: "13px", borderRadius: "50%", border: "1.3px solid #000",
      fontSize: "9pt", fontWeight: "bold", flexShrink: 0,
    }}>
      {marcado ? "X" : ""}
    </span>
  );
}

function V({ children, minWidth = "60px", grow = false }: { children: React.ReactNode; minWidth?: string; grow?: boolean }) {
  return (
    <span style={{
      borderBottom: "1px solid #000", display: "inline-block", minWidth,
      flex: grow ? 1 : undefined, padding: "0 3px",
    }}>
      {children ?? " "}
    </span>
  );
}

export default function ImprimirA04Client({
  consolidacion: c, renglones, nombreUnidad, codigoUnidad,
  direccionUnidad, municipio, todosFirmantes, firmantesSeleccionados: initFirmantes,
}: Props) {
  const router = useRouter();
  const correlativoA04 = `${c.numero_a04}-${c.anio_a04}`;
  const [firmantes, setFirmantes] = useState<Firmante[]>(initFirmantes);
  const [showSelector, setShowSelector] = useState(initFirmantes.length === 0);
  const [slot, setSlot] = useState<0 | 1 | 2>(0);

  function pickFirmante(idx: 0 | 1 | 2, f: Firmante) {
    setFirmantes(p => { const n = [...p]; n[idx] = f; return n; });
  }

  const renglon = renglones[0];
  const montoBruto = c.monto_bruto ?? c.total ?? 0;
  const iva = c.exento_iva ? 0 : montoIva(montoBruto);
  const liquido = c.total ?? (montoBruto - iva);

  // Con un solo renglón se usa la descripción/cantidad/unidad capturadas a
  // mano al regularizar (pueden traer texto resumido, ej. "Global") y el
  // total agregado de la consolidación. Con varios renglones no hay un
  // resumen manual por línea, así que cada uno se imprime con sus propios
  // datos reales (mismo cálculo de precio unitario e IVA que usa el DAB-60).
  const filas = renglones.length > 1
    ? renglones.map(r => {
        const total = r.total;
        const ivaFila = c.exento_iva ? 0 : montoIva(total);
        return {
          codigoPpr: codigoPprMostrar(r.codigo_ppr, r.codigo_igss),
          renglonNum: r.renglon != null ? String(r.renglon) : "—",
          categoria: (r.renglon != null ? NOMBRE_RENGLON.get(r.renglon) : null) ?? null,
          descripcion: r.nombre.toUpperCase(),
          unidad: r.unidad_medida ?? "—",
          cantidad: r.cantidad.toLocaleString("es-GT"),
          precioUnitario: r.cantidad > 0 ? total / r.cantidad : 0,
          total, iva: ivaFila, liquido: total - ivaFila,
        };
      })
    : [{
        codigoPpr: codigoPprMostrar(renglon?.codigo_ppr, renglon?.codigo_igss),
        renglonNum: renglon?.renglon != null ? String(renglon.renglon) : "—",
        categoria: (renglon?.renglon != null ? NOMBRE_RENGLON.get(renglon.renglon) : null) ?? null,
        descripcion: (c.a04_descripcion || renglon?.nombre || "—").toUpperCase(),
        unidad: c.a04_unidad_medida ?? renglon?.unidad_medida ?? "—",
        cantidad: (c.a04_cantidad ?? renglon?.cantidad)?.toLocaleString("es-GT") ?? "—",
        precioUnitario: montoBruto, total: montoBruto, iva, liquido,
      }];

  return (
    <>
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-700">A-04 SIAF — {correlativoA04}</span>
        <div className="flex items-center gap-3 ml-auto">
          {[0, 1, 2].map(idx => (
            <button key={idx}
              onClick={() => { setSlot(idx as 0 | 1 | 2); setShowSelector(true); }}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50 max-w-[220px]">
              <span className="truncate">
                {firmantes[idx]
                  ? <><strong>{firmantes[idx].nombre}</strong> — {firmantes[idx].cargo}</>
                  : <span className="text-gray-400">{FIRMA_SLOTS[idx]}…</span>}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
            </button>
          ))}
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      {showSelector && (
        <div className="no-print fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="font-semibold text-sm">Selecciona firmante — {FIRMA_SLOTS[slot]}</p>
              <button onClick={() => setShowSelector(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="py-2 max-h-64 overflow-y-auto">
              {todosFirmantes.map(f => (
                <button key={f.id} onMouseDown={() => { pickFirmante(slot, f); setShowSelector(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-brand-50">
                  <p className="text-sm font-medium">{f.nombre}</p>
                  <p className="text-xs text-gray-500">{f.cargo}</p>
                </button>
              ))}
              {todosFirmantes.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">No hay firmantes configurados.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div id="print-wrapper">
        <div id="a4-sheet" style={{ fontFamily: FONT, color: C }}>

          {/* Encabezado: logo + forma + título */}
          <div style={{ border: B, borderRadius: R, display: "flex", alignItems: "center", padding: "8px 14px", marginBottom: "10px" }}>
            <img src="/LOGO_SIAF01.svg" alt="IGSS" style={{ height: "48px", width: "auto", flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ margin: 0, fontWeight: "bold", fontSize: "12pt" }}>ORDEN PARA RENDIR FONDO ROTATIVO</p>
            </div>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "9pt", flexShrink: 0, whiteSpace: "nowrap" }}>FORMA: A-04 SIAF</p>
          </div>

          {/* Recuadro: Datos Unidad Ejecutora / Método de Compra */}
          <div style={{ border: B, borderRadius: R, display: "flex", marginBottom: "10px", fontSize: "9pt" }}>
            <div style={{ flex: 1, padding: "10px 12px", borderRight: B }}>
              <p style={{ margin: "0 0 8px 0", fontWeight: "bold", textAlign: "center", fontSize: "8.5pt" }}>
                DATOS UNIDAD EJECUTORA / CENTRO DE COSTO
              </p>
              <div style={{ display: "flex", gap: "14px", marginBottom: "6px" }}>
                <span><strong>Correlativo No.</strong> <V minWidth="40px">{correlativoA04}</V></span>
                <span><strong>Fecha:</strong> <V minWidth="80px">{c.a04_fecha ?? null}</V></span>
                <span><strong>Código Unidad Ejecutora:</strong> <V minWidth="50px">{codigoUnidad}</V></span>
              </div>
              <p style={{ margin: "0 0 6px 0", display: "flex", alignItems: "baseline", gap: "4px" }}>
                <strong style={{ whiteSpace: "nowrap" }}>Nombre Unidad Ejecutora o Centro de Costo:</strong>
                <V grow minWidth="80px"><strong>{nombreUnidad}</strong></V>
              </p>
              <p style={{ margin: 0, display: "flex", alignItems: "baseline", gap: "4px" }}>
                <strong style={{ whiteSpace: "nowrap" }}>Dirección Unidad Ejecutora o centro de Costo:</strong>
                <V grow minWidth="80px">{direccionUnidad}, {municipio}</V>
              </p>
            </div>
            <div style={{ width: "180px", flexShrink: 0, padding: "10px 12px" }}>
              <p style={{ margin: "0 0 8px 0", fontWeight: "bold", textAlign: "center", fontSize: "8.5pt" }}>MÉTODO DE COMPRA</p>
              {METODOS.map(m => (
                <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span>{METODO_LABEL[m]}</span>
                  <Radio marcado={c.tipo_compra === m} />
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>OTROS</span>
                <span style={{ borderBottom: "1px solid #000", width: "40px", height: "12px" }} />
              </div>
            </div>
          </div>

          {/* Recuadro: Datos del proveedor */}
          <div style={{ border: B, borderRadius: R, padding: "10px 12px", marginBottom: "10px", fontSize: "9pt" }}>
            <p style={{ margin: "0 0 8px 0", fontWeight: "bold", textAlign: "center", fontSize: "8.5pt" }}>DATOS DEL PROVEEDOR</p>
            <div style={{ display: "flex", gap: "10px", marginBottom: "6px" }}>
              <span style={{ flex: 1, display: "flex", alignItems: "baseline", gap: "4px" }}>
                <strong style={{ whiteSpace: "nowrap" }}>Nombre o Razón Social:</strong>
                <V grow minWidth="80px">{c.proveedor_nombre ?? null}</V>
              </span>
              <span style={{ width: "200px", flexShrink: 0, display: "flex", alignItems: "baseline", gap: "4px" }}>
                <strong style={{ whiteSpace: "nowrap" }}>NIT/CUI:</strong>
                <V grow minWidth="60px">{c.proveedor_nit ?? null}</V>
              </span>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <span style={{ flex: 1, display: "flex", alignItems: "baseline", gap: "4px" }}>
                <strong style={{ whiteSpace: "nowrap" }}>Dirección:</strong>
                <V grow minWidth="80px">{c.proveedor_direccion ?? null}</V>
              </span>
              <span style={{ width: "200px", flexShrink: 0, display: "flex", alignItems: "baseline", gap: "4px" }}>
                <strong style={{ whiteSpace: "nowrap" }}>Teléfono:</strong>
                <V grow minWidth="60px">{c.proveedor_telefono ?? null}</V>
              </span>
            </div>
          </div>

          {/* Detalle de bienes y/o servicios — acá la tabla ES el recuadro
              (título y línea de DTE van como filas de la misma tabla), sin
              caja redondeada aparte, tal como la Forma A-04 SIAF real. */}
          <table style={{
            width: "100%", tableLayout: "fixed", borderCollapse: "collapse",
            fontSize: "8pt", marginBottom: "10px", border: TB,
          }}>
            <colgroup>
              <col style={{ width: "7%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "27%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <tbody>
              <tr>
                <td colSpan={10} style={{ border: TB, padding: "6px 4px 2px 4px", fontWeight: "bold", textAlign: "center", fontSize: "8.5pt" }}>
                  DETALLE DE BIENES Y/O SERVICIOS
                </td>
              </tr>
              <tr>
                <td colSpan={10} style={{ border: TB, padding: "2px 4px 6px 4px", textAlign: "center", fontSize: "8pt" }}>
                  ADQUIRIDOS SEGÚN DOCUMENTO TRIBUTARIO ELECTRÓNICO -DTE- No. <V minWidth="70px">{c.a04_dte_numero ?? null}</V>
                  &nbsp;&nbsp;Serie: <V minWidth="50px">{c.a04_dte_serie ?? null}</V>
                  &nbsp;&nbsp;de fecha: <V minWidth="80px">{c.a04_dte_fecha ?? null}</V>
                </td>
              </tr>
              <tr>
                <th style={{ border: TB, padding: "4px", textAlign: "center" }}>No. Pedido</th>
                <th style={{ border: TB, padding: "4px", textAlign: "center" }}>Código PpR</th>
                <th style={{ border: TB, padding: "4px", textAlign: "center" }}>Renglón</th>
                <th style={{ border: TB, padding: "4px", textAlign: "center" }}>Descripción</th>
                <th style={{ border: TB, padding: "4px", textAlign: "center" }}>Unidad de Medida</th>
                <th style={{ border: TB, padding: "4px", textAlign: "center" }}>Cantidad</th>
                <th style={{ border: TB, padding: "4px", textAlign: "center" }}>Precio Unitario</th>
                <th style={{ border: TB, padding: "4px", textAlign: "center" }}>Total</th>
                <th style={{ border: TB, padding: "4px", textAlign: "center" }}>(-) IVA</th>
                <th style={{ border: TB, padding: "4px", textAlign: "center" }}>Liquido</th>
              </tr>
              {filas.map((f, i) => (
                <tr key={i}>
                  <td style={{ border: TB, padding: "14px 4px", textAlign: "center", fontWeight: "bold" }}>{c.a04_no_pedido ?? "—"}</td>
                  <td style={{ border: TB, padding: "14px 4px", textAlign: "center", fontWeight: "bold" }}>{f.codigoPpr}</td>
                  <td style={{ border: TB, padding: "14px 4px", textAlign: "center", fontWeight: "bold" }}>{f.renglonNum}</td>
                  <td style={{ border: TB, padding: "14px 6px", wordBreak: "break-word" }}>
                    {f.categoria && <p style={{ margin: 0, fontWeight: "bold" }}>{f.categoria}</p>}
                    <p style={{ margin: 0 }}>{f.descripcion}</p>
                  </td>
                  <td style={{ border: TB, padding: "14px 4px", textAlign: "center", fontWeight: "bold" }}>{f.unidad}</td>
                  <td style={{ border: TB, padding: "14px 4px", textAlign: "center", fontWeight: "bold" }}>{f.cantidad}</td>
                  <td style={{ border: TB, padding: "14px 4px", textAlign: "center", fontWeight: "bold" }}>{Q(f.precioUnitario)}</td>
                  <td style={{ border: TB, padding: "14px 4px", textAlign: "center", fontWeight: "bold" }}>{Q(f.total)}</td>
                  <td style={{ border: TB, padding: "14px 4px", textAlign: "center", fontWeight: "bold" }}>{Q(f.iva)}</td>
                  <td style={{ border: TB, padding: "14px 4px", textAlign: "center", fontWeight: "bold" }}>{Q(f.liquido)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={7} style={{ border: TB, padding: "4px", textAlign: "right", fontWeight: "bold" }}>Totales</td>
                <td style={{ border: TB, padding: "4px", textAlign: "center", fontWeight: "bold" }}>{Q(montoBruto)}</td>
                <td style={{ border: TB, padding: "4px", textAlign: "center", fontWeight: "bold" }}>{Q(iva)}</td>
                <td style={{ border: TB, padding: "4px", textAlign: "center", fontWeight: "bold" }}>{Q(liquido)}</td>
              </tr>
            </tbody>
          </table>

          {/* Firmas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "20px" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                border: B, borderRadius: R, minHeight: "130px", boxSizing: "border-box",
                padding: "80px 10px 14px 10px", textAlign: "center", fontSize: "8.5pt",
              }}>
                <p style={{ margin: 0, fontWeight: "bold" }}>{firmantes[i]?.nombre || "—"}</p>
                <p style={{ margin: "2px 0 0 0" }}>{firmantes[i]?.cargo || FIRMA_SLOTS[i]}</p>
                {firmantes[i]?.unidad && <p style={{ margin: "2px 0 0 0" }}>{firmantes[i].unidad}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        #print-wrapper {
          background: #94a3b8; display: flex; justify-content: center; align-items: flex-start;
          padding: 40px 20px; min-height: 100vh; margin-top: 52px; box-sizing: border-box;
        }
        #a4-sheet {
          background: white; width: 297mm; min-height: 210mm; box-shadow: 0 4px 32px rgba(0,0,0,0.22);
          padding: 8mm; box-sizing: border-box;
        }
        .no-print { display: block; }
        @media print {
          @page { size: A4 landscape; margin: 6mm; }
          .no-print { display: none !important; }
          #print-wrapper { background: white !important; padding: 0 !important; margin: 0 !important; min-height: 0 !important; display: block !important; }
          #a4-sheet { width: 100% !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
        }
      `}</style>
    </>
  );
}
