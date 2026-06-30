import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS pre_orden TEXT`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS numero_adjudicacion TEXT`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS destino TEXT`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS regularizado BOOLEAN`;

await sql`
  CREATE TABLE IF NOT EXISTS consolidacion_precios (
    id               SERIAL PRIMARY KEY,
    consolidacion_id INTEGER NOT NULL REFERENCES consolidaciones(id) ON DELETE CASCADE,
    codigo_igss      INTEGER,
    subproducto      TEXT NOT NULL,
    precio_unitario  DOUBLE PRECISION NOT NULL
  )
`;

console.log("✅ Migración completar-adjudicacion completada.");
process.exit(0);
