import { getOrdenesEnDab } from "@/lib/adjudicacion/dab60-actions";
import Dab60Client from "./Dab60Client";

export default async function Dab60Page() {
  const ordenes = await getOrdenesEnDab();
  return <Dab60Client ordenes={ordenes} />;
}
