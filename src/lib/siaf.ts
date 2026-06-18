import { db, sql } from "@/lib/db";

export async function nextSiafNumber(): Promise<number> {
  const result = await db.execute(
    sql`UPDATE siaf_seq SET valor = valor + 1 WHERE id = 1 RETURNING valor`
  );
  return Number((result.rows[0] as { valor: number }).valor);
}

export async function currentSiafNumber(): Promise<number> {
  try {
    const result = await db.execute(
      sql`SELECT valor FROM siaf_seq WHERE id = 1`
    );
    return Number((result.rows[0] as { valor: number } | undefined)?.valor) || 0;
  } catch {
    return 0;
  }
}

// Correlativo por tipo y año — se reinicia en 1 cada año (formato: n/yyyy)
export async function nextCorrelativo(tipo: string, year?: number): Promise<number> {
  const y = year ?? new Date().getFullYear();
  const result = await db.execute(
    sql`SELECT COALESCE(MAX(siaf_numero), 0) + 1 AS next
        FROM servicios
        WHERE tipo_documento = ${tipo}
        AND EXTRACT(YEAR FROM fecha::date) = ${y}`
  );
  return Number((result.rows[0] as any).next) || 1;
}
