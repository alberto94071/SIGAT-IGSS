import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS acta_aprobada BOOLEAN NOT NULL DEFAULT false`;
  console.log("✓ Columna acta_aprobada en consolidaciones");

  await sql`
    CREATE TABLE IF NOT EXISTS actas_adjudicacion (
      id                SERIAL PRIMARY KEY,
      consolidacion_id  INTEGER NOT NULL UNIQUE REFERENCES consolidaciones(id) ON DELETE CASCADE,
      no_formulario     TEXT NOT NULL,
      no_acta           TEXT NOT NULL,
      lugar             TEXT NOT NULL,
      fecha             TEXT NOT NULL,
      hora              TEXT NOT NULL,
      estado            TEXT NOT NULL DEFAULT 'Generada',
      previsualizada    BOOLEAN NOT NULL DEFAULT false,
      motivo_rechazo    TEXT,
      generado_por      INTEGER REFERENCES usuarios(id),
      aprobado_por      INTEGER REFERENCES usuarios(id),
      aprobado_en       TEXT,
      rechazado_por     INTEGER REFERENCES usuarios(id),
      rechazado_en      TEXT,
      created_at        TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  console.log("✓ Tabla actas_adjudicacion creada");

  console.log("\n¡Listo!");
}

main().catch(console.error);
