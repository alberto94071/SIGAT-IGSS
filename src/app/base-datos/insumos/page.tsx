import { db } from "@/lib/db";
import { baseDatosCentral } from "@/lib/schema";
import BaseDatosClient from "../BaseDatosClient";

export default async function InsumosPage() {
  const registros = await db
    .select()
    .from(baseDatosCentral)
    .orderBy(baseDatosCentral.nombre);

  return <BaseDatosClient registros={registros} />;
}
