import { getValesPendientes } from "@/app/caja-chica/vale/actions";
import ValesClient from "./ValesClient";

export default async function FondoRotativoValesPage() {
  const vales = await getValesPendientes();
  return <ValesClient vales={vales} />;
}
