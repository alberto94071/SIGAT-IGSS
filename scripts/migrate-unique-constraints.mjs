import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS consolidaciones_pre_orden_unique
  ON consolidaciones (pre_orden)
  WHERE pre_orden IS NOT NULL
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS consolidaciones_numero_adjudicacion_unique
  ON consolidaciones (numero_adjudicacion)
  WHERE numero_adjudicacion IS NOT NULL
`;

console.log("✅ Unique constraints agregados a consolidaciones.");
process.exit(0);
