type Renglon = { renglon: number | null; subproducto: string; nombre: string; cantidad: number };

export default function RenglonBadges({ renglones }: { renglones: Renglon[] }) {
  if (renglones.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {renglones.map((r, i) => (
        <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-mono whitespace-nowrap">
          Renglón {r.renglon ?? "—"} · {r.nombre} ({r.cantidad.toLocaleString("es-GT")})
        </span>
      ))}
    </div>
  );
}
