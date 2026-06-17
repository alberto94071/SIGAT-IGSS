import { db } from "@/lib/db";
import { pagos, configuracion } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import PrintButtons from "@/components/PrintButtons";

export default async function SIAFPrintPage({
  searchParams,
}: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  if (!id) notFound();

  const [pago] = await db.select().from(pagos).where(eq(pagos.id, Number(id)));
  if (!pago) notFound();

  const [config] = await db.select().from(configuracion).limit(1);

  const hoy = new Date().toLocaleDateString("es-GT", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <div className="p-8 max-w-4xl mx-auto text-sm font-sans">
      <PrintButtons />

      {/* Header */}
      <div className="text-center mb-6">
        <p className="text-xs text-gray-500">FORMA: A-04 SIAF</p>
        <h1 className="text-lg font-bold uppercase tracking-wide mt-1">
          Orden para Rendir Fondo Rotativo
        </h1>
        <p className="text-xs text-gray-400 mt-1">Instituto Guatemalteco de Seguridad Social</p>
      </div>

      {/* Datos unidad ejecutora */}
      <div className="border border-gray-400 p-4 mb-4">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-semibold uppercase text-gray-500 mb-1">Datos Unidad Ejecutora</p>
            <p><strong>Nombre:</strong> {config?.nombre_unidad}</p>
            <p><strong>Código:</strong> {config?.codigo_unidad} &nbsp;·&nbsp; <strong>Código Contable:</strong> {config?.codigo_contable}</p>
          </div>
          <div className="text-right">
            <p><strong>Correlativo N°:</strong> {pago.siaf_numero}</p>
            <p><strong>Fecha:</strong> {hoy}</p>
            <p><strong>Cuatrimestre:</strong> {pago.cuatrimestre}</p>
          </div>
        </div>
      </div>

      {/* Método de compra */}
      <div className="border border-gray-400 p-3 mb-4 text-xs">
        <p className="font-semibold uppercase mb-2">Método de Compra</p>
        <div className="flex gap-8">
          {["Baja Cuantia","Compra Directa","Contrato Abierto","Casos de Excepcion"].map(m => (
            <label key={m} className="flex items-center gap-1.5">
              <span className={`w-4 h-4 border border-gray-500 inline-flex items-center justify-center text-xs ${pago.metodo_compra === m ? "bg-gray-800 text-white" : ""}`}>
                {pago.metodo_compra === m ? "✓" : ""}
              </span>
              {m}
            </label>
          ))}
        </div>
      </div>

      {/* Tabla de items */}
      <table className="w-full border border-gray-400 text-xs mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-2 py-1.5 text-left">Renglón</th>
            <th className="border border-gray-400 px-2 py-1.5 text-left">Descripción del bien o servicio</th>
            <th className="border border-gray-400 px-2 py-1.5 text-left">Unidad</th>
            <th className="border border-gray-400 px-2 py-1.5 text-right">Cant.</th>
            <th className="border border-gray-400 px-2 py-1.5 text-right">Precio Unit.</th>
            <th className="border border-gray-400 px-2 py-1.5 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-gray-400 px-2 py-2">{pago.renglon}</td>
            <td className="border border-gray-400 px-2 py-2">{pago.descripcion}</td>
            <td className="border border-gray-400 px-2 py-2">{pago.unidad_medida}</td>
            <td className="border border-gray-400 px-2 py-2 text-right tabular-nums">
              {pago.cantidad ? pago.cantidad.toLocaleString("es-GT") : ""}
            </td>
            <td className="border border-gray-400 px-2 py-2 text-right tabular-nums">
              {pago.monto && pago.cantidad
                ? `Q ${(pago.monto / pago.cantidad).toFixed(4)}`
                : ""}
            </td>
            <td className="border border-gray-400 px-2 py-2 text-right tabular-nums font-bold">
              Q {(pago.monto ?? 0).toLocaleString("es-GT", { minimumFractionDigits: 2 })}
            </td>
          </tr>
          {/* filas vacías */}
          {[...Array(4)].map((_, i) => (
            <tr key={i}>
              {[...Array(6)].map((_, j) => (
                <td key={j} className="border border-gray-400 px-2 py-2">&nbsp;</td>
              ))}
            </tr>
          ))}
          <tr className="bg-gray-50 font-bold">
            <td colSpan={5} className="border border-gray-400 px-2 py-2 text-right uppercase">Total</td>
            <td className="border border-gray-400 px-2 py-2 text-right tabular-nums">
              Q {(pago.monto ?? 0).toLocaleString("es-GT", { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Proveedor */}
      <div className="border border-gray-400 p-3 mb-6 text-xs">
        <div className="grid grid-cols-3 gap-4">
          <div><p className="text-gray-500">NIT Proveedor</p><p className="font-semibold">{pago.nit_proveedor ?? "—"}</p></div>
          <div><p className="text-gray-500">Proveedor / Beneficiario</p><p className="font-semibold">{pago.proveedor ?? "—"}</p></div>
          <div><p className="text-gray-500">N° Cheque</p><p className="font-semibold">{pago.numero_cheque ?? "—"}</p></div>
        </div>
      </div>

      {/* Firmas */}
      <div className="grid grid-cols-3 gap-8 mt-12 text-xs text-center">
        <div>
          <div className="border-t border-gray-600 pt-2 mt-8">
            <p className="font-semibold">{config?.nombre_solicitante}</p>
            <p className="text-gray-500">Solicitante · Empleado {config?.numero_empleado_sol}</p>
          </div>
        </div>
        <div>
          <div className="border-t border-gray-600 pt-2 mt-8">
            <p className="font-semibold">{config?.nombre_responsable}</p>
            <p className="text-gray-500">Responsable FRI · Empleado {config?.numero_empleado_resp}</p>
          </div>
        </div>
        <div>
          <div className="border-t border-gray-600 pt-2 mt-8">
            <p className="font-semibold">Autorizado por</p>
            <p className="text-gray-500">Jefe / Director</p>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 mt-8">{config?.municipio} · {hoy}</p>
    </div>
  );
}
