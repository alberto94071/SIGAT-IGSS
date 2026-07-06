import { getOrdenesEnCompromiso } from "@/lib/adjudicacion/compromiso-actions";
import CompromisoClient from "./CompromisoClient";

export default async function CompromisoPage() {
  const ordenes = await getOrdenesEnCompromiso();
  return <CompromisoClient ordenes={ordenes} />;
}
