import { getOrdenes } from "../adjudicacion/actions";
import OrdenesClient from "./OrdenesClient";

export default async function OrdenesPage() {
  const ordenes = await getOrdenes();
  return <OrdenesClient ordenes={ordenes} />;
}
