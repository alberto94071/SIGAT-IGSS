import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import HojaDeRutaClient from "./HojaDeRutaClient";

export default async function HojaDeRutaPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <HojaDeRutaClient />;
}
