import { db } from "@/lib/db";
import { baseDatosCentral } from "@/lib/schema";
import BaseDatosClient from "../BaseDatosClient";
import { ilike, or, eq, sql, and } from "drizzle-orm";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    renglon?: string;
    page?: string;
  }>;
}

export default async function InsumosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = (params.q || "").trim();
  const renglonStr = (params.renglon || "").trim();
  const page = Number(params.page) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;

  // 1. Construir cláusula where
  const conditions = [];

  if (q) {
    conditions.push(
      or(
        ilike(baseDatosCentral.nombre, `%${q}%`),
        ilike(baseDatosCentral.caracteristicas, `%${q}%`),
        ilike(baseDatosCentral.presentacion, `%${q}%`),
        sql`${baseDatosCentral.codigo_ppr}::text ILIKE ${'%' + q + '%'}`,
        sql`${baseDatosCentral.codigo_igss}::text ILIKE ${'%' + q + '%'}`
      )
    );
  }

  if (renglonStr) {
    const rNum = Number(renglonStr);
    if (!isNaN(rNum)) {
      conditions.push(eq(baseDatosCentral.renglon, rNum));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 2. Conteo total de coincidencias para la paginación
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(baseDatosCentral)
    .where(whereClause);
  const totalCount = countResult?.count ?? 0;

  // 3. Obtener registros paginados
  const registros = await db
    .select()
    .from(baseDatosCentral)
    .where(whereClause)
    .orderBy(baseDatosCentral.nombre)
    .limit(limit)
    .offset(offset);

  // 4. Obtener todos los renglones únicos para el selector (dropdown)
  const uniqueRenglonesResult = await db
    .select({ renglon: baseDatosCentral.renglon })
    .from(baseDatosCentral)
    .where(sql`renglon IS NOT NULL`)
    .groupBy(baseDatosCentral.renglon)
    .orderBy(baseDatosCentral.renglon);
  
  const allRenglones = uniqueRenglonesResult
    .map(r => r.renglon)
    .filter(Boolean) as number[];

  return (
    <BaseDatosClient
      registros={registros}
      totalCount={totalCount}
      currentPage={page}
      limit={limit}
      allRenglones={allRenglones}
      initQ={q}
      initRenglon={renglonStr}
    />
  );
}

