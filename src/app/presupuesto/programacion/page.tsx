import { getProgramacionData } from "@/lib/programacion-actions";
import ProgramacionClient from "./ProgramacionClient";

export default async function ProgramacionPage() {
  const data = await getProgramacionData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Programación y Reprogramación</h1>
        <p className="text-gray-600 mt-1">
          Programación presupuestaria por renglones de gasto para los meses de Septiembre a Diciembre 2026.
        </p>
      </div>

      <ProgramacionClient data={data} />
    </div>
  );
}
