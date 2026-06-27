"use server";
import { db } from "@/lib/db";
import { baseDatosCentral } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getBaseDatos() {
  return db
    .select()
    .from(baseDatosCentral)
    .orderBy(baseDatosCentral.nombre);
}

export async function crearRegistroBD(data: {
  codigo_siges?: string | null;
  codigo_formulacion?: number | null;
  subproducto?: string | null;
  codigo_ppr?: number | null;
  nombre: string;
  caracteristicas?: string | null;
  presentacion?: string | null;
  renglon?: number | null;
  precio_unitario?: number | null;
  cantidad_2027?: number | null; monto_2027?: number | null;
  cantidad_2028?: number | null; monto_2028?: number | null;
  cantidad_2029?: number | null; monto_2029?: number | null;
  cantidad_2030?: number | null; monto_2030?: number | null;
  cantidad_2031?: number | null; monto_2031?: number | null;
}) {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  const [row] = await db.insert(baseDatosCentral).values(data).returning();
  revalidatePath("/base-datos");
  return { registro: row };
}

export async function eliminarRegistroBD(id: number) {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  await db.delete(baseDatosCentral).where(eq(baseDatosCentral.id, id));
  revalidatePath("/base-datos");
  return { ok: true };
}
