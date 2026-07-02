import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  // Rechazo de SIAF: motivo + quién + cuándo
  await sql`ALTER TABLE siaf_compras ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT`;
  await sql`ALTER TABLE siaf_compras ADD COLUMN IF NOT EXISTS rechazado_por INTEGER REFERENCES usuarios(id)`;
  await sql`ALTER TABLE siaf_compras ADD COLUMN IF NOT EXISTS rechazado_en TEXT`;
  console.log("✓ Columnas de rechazo agregadas a siaf_compras");

  // Bandeja de notificaciones (campanita)
  await sql`
    CREATE TABLE IF NOT EXISTS notificaciones (
      id              SERIAL PRIMARY KEY,
      usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
      tipo            TEXT NOT NULL,
      titulo          TEXT NOT NULL,
      mensaje         TEXT NOT NULL,
      ruta            TEXT,
      referencia_tipo TEXT,
      referencia_id   INTEGER,
      leida           BOOLEAN NOT NULL DEFAULT false,
      created_at      TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  console.log("✓ Tabla notificaciones creada");

  console.log("\n¡Listo!");
}

main().catch(console.error);
