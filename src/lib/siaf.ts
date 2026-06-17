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
    return Number((result.rows[0] as { valor: number } | undefined)?.valor) || 12;
  } catch {
    return 12;
  }
}
