import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getActasHistorial } from "@/lib/adjudicacion/actas-adjudicacion-actions";
import HistorialClient from "./HistorialClient";

export default async function HistorialPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const rows = await getActasHistorial();
  return <HistorialClient rows={rows} />;
}
