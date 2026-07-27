import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS fri_fondo_rotativo (
      id SERIAL PRIMARY KEY,
      numero INTEGER NOT NULL,
      anio INTEGER NOT NULL,
      total DOUBLE PRECISION NOT NULL,
      estado TEXT NOT NULL DEFAULT 'Generado',
      fecha_reintegro TEXT,
      creado_por INTEGER REFERENCES usuarios(id),
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  console.log("✓ Tabla fri_fondo_rotativo");

  await sql`ALTER TABLE fondo_rotativo_pagos ADD COLUMN IF NOT EXISTS fri_id INTEGER REFERENCES fri_fondo_rotativo(id)`;
  console.log("✓ Columna fondo_rotativo_pagos.fri_id");

  await sql`ALTER TABLE polizas ADD COLUMN IF NOT EXISTS fri_id INTEGER REFERENCES fri_fondo_rotativo(id)`;
  console.log("✓ Columna polizas.fri_id");

  console.log("\n¡Listo!");
}

main().catch(console.error);
