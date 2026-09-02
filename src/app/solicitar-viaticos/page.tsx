import { requireColaborador } from "@/lib/modulo-access";
import { getMisViaticos } from "./actions";
import MisViaticosClient from "./MisViaticosClient";

export default async function SolicitarViaticosPage() {
  await requireColaborador();
  const solicitudes = await getMisViaticos();
  return <MisViaticosClient solicitudes={solicitudes} />;
}
