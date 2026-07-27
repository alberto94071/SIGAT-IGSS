import { getPagosPendientesFri, getFrisConformados } from "@/lib/fri-actions";
import FriClient from "./FriClient";

export default async function FriPage() {
  const [pendientes, fris] = await Promise.all([
    getPagosPendientesFri(),
    getFrisConformados(),
  ]);
  return <FriClient pendientes={pendientes} fris={fris} />;
}
