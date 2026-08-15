import type { TrazabilidadConsolidacion } from "@/lib/adjudicacion/trazabilidad-utils";

// Panel de detalle completo de un ítem/orden/pago, para usar dentro del
// "detail" de <ExpandableRow /> en cualquier pantalla del pipeline de
// Compras/Presupuesto. "cadena" son los datos propios de esa pantalla que no
// vienen en TrazabilidadConsolidacion (No. de Compromiso, Devengado, DAB-60,
// Vale, FRI, Cheque...) — cada pantalla arma su propia lista según lo que
// tenga a mano; los que no apliquen a esa etapa simplemente no se pasan.
export type CadenaChip = { label: string; value: string | number | null | undefined };

export default function TrazabilidadPanel({
  titulo, cadena = [], traz,
}: {
  titulo: string;
  cadena?: CadenaChip[];
  traz: TrazabilidadConsolidacion | null;
}) {
  const chips: CadenaChip[] = [
    { label: "Consolidación", value: traz ? `${traz.consolidacion_numero}/${traz.consolidacion_anio}` : null },
    { label: "Pre-Orden", value: traz?.pre_orden },
    { label: "Adjudicación", value: traz?.numero_adjudicacion },
    { label: "SIAF de origen", value: traz && traz.siaf_correlativos.length > 0 ? traz.siaf_correlativos.join(", ") : null },
    ...cadena,
  ].filter(c => c.value != null && c.value !== "");

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{titulo}</p>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {chips.map((c, i) => (
            <span key={i} className="text-[11px] bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded-lg">
              <span className="text-gray-400">{c.label}:</span> <strong className="font-mono">{c.value}</strong>
            </span>
          ))}
        </div>
      )}

      {!traz || traz.items.length === 0 ? (
        <p className="text-sm text-gray-400">Sin insumos para mostrar.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Código IGSS</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">PPR</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Insumo</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Subproducto</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Renglón</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">Cantidad</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">P. Unitario</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">Monto</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">SIAF de origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {traz.items.map((item, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{item.codigo_igss ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{item.codigo_ppr ?? "—"}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{item.nombre}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{item.subproducto}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-600 whitespace-nowrap">{item.renglon ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700 whitespace-nowrap">
                    {item.cantidad_total.toLocaleString("es-GT")} {item.unidad_medida ?? ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700 whitespace-nowrap">
                    {item.precio_unitario != null ? `Q${item.precio_unitario.toLocaleString("es-GT", { minimumFractionDigits: 2 })}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">
                    Q{item.monto_total.toLocaleString("es-GT", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                    {item.origenes.map(o => `${o.siaf_numero}/${o.siaf_anio} (${o.cantidad.toLocaleString("es-GT")})`).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
