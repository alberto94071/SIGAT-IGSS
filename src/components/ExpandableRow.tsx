import { Fragment, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

// Mismo patrón "fila + segunda fila con colSpan" que ya se usaba copiado a
// mano en SiafClient/ConsolidacionClient/etc. — acá centralizado para que
// todas las pantallas del pipeline de Compras/Presupuesto lo compartan.
// El caller pone el <th className="w-8"></th> del encabezado y pasa las
// <td> de la fila visible como children (sin la celda del chevron, que
// pone este componente); "detail" es el contenido del panel que se
// despliega, normalmente un <TrazabilidadPanel />.
export default function ExpandableRow({
  expanded, onToggle, colSpan, children, detail, rowClassName,
}: {
  expanded: boolean;
  onToggle: () => void;
  colSpan: number;
  children: ReactNode;
  detail: ReactNode;
  rowClassName?: string;
}) {
  return (
    <Fragment>
      <tr
        className={rowClassName ?? "border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50"}
        onClick={onToggle}>
        <td className="px-4 py-3 text-gray-400 w-8">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </td>
        {children}
      </tr>
      {expanded && (
        <tr className="bg-brand-50/40">
          <td colSpan={colSpan} className="px-6 py-4">
            {detail}
          </td>
        </tr>
      )}
    </Fragment>
  );
}
