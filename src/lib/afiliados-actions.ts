"use server";
import { db } from "@/lib/db";
import { pasajesAfiliados } from "@/lib/schema";
import { eq, or, ilike, sql } from "drizzle-orm";

// Base de afiliados IGSS — compartida por cualquier módulo que necesite buscar
// un afiliado por número de afiliación o nombre (Caja Chica/Solicitud Pasaje,
// futuros módulos de Viáticos, etc.). Solo lectura desde la app: se carga por
// importación (ver scripts/migrate-pasajes.mjs).

export async function buscarAfiliadoPorAfiliacion(afiliacion: string) {
  const a = afiliacion.trim();
  if (!a) return null;
  const [row] = await db.select().from(pasajesAfiliados).where(eq(pasajesAfiliados.afiliacion, a)).limit(1);
  return row ?? null;
}

// Búsqueda por número de afiliación (prefijo) o nombre — usada por el picker
// en los formularios. Server-side porque la tabla tiene ~3000 filas.
export async function buscarAfiliados(query: string) {
  const q = query.trim();
  if (q.length < 2) return [];
  return db.select().from(pasajesAfiliados)
    .where(or(
      ilike(pasajesAfiliados.afiliacion, `${q}%`),
      ilike(pasajesAfiliados.nombre, `%${q}%`),
      ilike(pasajesAfiliados.dpi, `${q}%`),
    ))
    .orderBy(pasajesAfiliados.nombre)
    .limit(30);
}

export async function contarAfiliados(): Promise<number> {
  const res = await db.execute(sql`SELECT COUNT(*)::int AS n FROM pasajes_afiliados`);
  return Number((res.rows[0] as any).n) || 0;
}
