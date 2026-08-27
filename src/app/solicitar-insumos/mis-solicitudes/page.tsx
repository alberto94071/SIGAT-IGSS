import { requireColaborador } from "@/lib/modulo-access";
import { getMiSolicitudActiva, getMisSolicitudes } from "../actions";
import MiSolicitudClient from "./MiSolicitudClient";

export default async function MisSolicitudesPage() {
  await requireColaborador();
  const [borrador, solicitudes] = await Promise.all([getMiSolicitudActiva(), getMisSolicitudes()]);
  return <MiSolicitudClient borrador={borrador} solicitudes={solicitudes} />;
}
