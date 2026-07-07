import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listarHojaDeRuta } from "@/lib/hoja-de-ruta-actions";
import HojaDeRutaClient from "./HojaDeRutaClient";

export default async function HojaDeRutaPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const registros = await listarHojaDeRuta();
  return <HojaDeRutaClient registros={registros} />;
}
