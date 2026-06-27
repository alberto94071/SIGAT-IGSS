import { neon } from "@neondatabase/serverless";

const DB = "postgresql://neondb_owner:npg_gaDnJLs0lK4T@ep-winter-boat-atha96e8-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(DB);

await sql`
  CREATE TABLE IF NOT EXISTS consolidaciones (
    id         SERIAL PRIMARY KEY,
    numero     INTEGER NOT NULL,
    anio       INTEGER NOT NULL,
    fecha      TEXT NOT NULL,
    creado_por INTEGER,
    created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
  )
`;

await sql`
  ALTER TABLE siaf_compras
  ADD COLUMN IF NOT EXISTS consolidacion_id INTEGER
`;

console.log("✅ Tabla consolidaciones creada. Columna consolidacion_id agregada a siaf_compras.");
process.exit(0);
