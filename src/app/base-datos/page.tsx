import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { baseDatosCentral } from "@/lib/schema";
import BaseDatosClient from "./BaseDatosClient";

export default async function BaseDatosPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const registros = await db
    .select()
    .from(baseDatosCentral)
    .orderBy(baseDatosCentral.nombre);

  return <BaseDatosClient registros={registros} />;
}
