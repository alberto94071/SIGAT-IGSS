import { neon } from "@neondatabase/serverless";

const DB = "postgresql://neondb_owner:npg_gaDnJLs0lK4T@ep-winter-boat-atha96e8-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(DB);

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
