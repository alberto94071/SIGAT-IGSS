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

// Correlativo atómico por tipo de documento (SIAF, Vale, Formulario, Boleta, Póliza)
export async function nextCorrelativo(tipo: string): Promise<number> {
  const result = await db.execute(
    sql`SELECT COALESCE(MAX(siaf_numero), 0) + 1 AS next
        FROM servicios WHERE tipo_documento = ${tipo}`
  );
  return Number((result.rows[0] as any).next) || 1;
}
