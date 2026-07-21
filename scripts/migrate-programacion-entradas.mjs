import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS programacion_entradas (
      id                SERIAL PRIMARY KEY,
      ejercicio_fiscal  INTEGER NOT NULL DEFAULT 2026,
      cuatrimestre      INTEGER NOT NULL,
      renglon           INTEGER NOT NULL,
      subproducto       TEXT NOT NULL,
      tipo              TEXT NOT NULL,
      mes1              DOUBLE PRECISION NOT NULL DEFAULT 0,
      mes2              DOUBLE PRECISION NOT NULL DEFAULT 0,
      mes3              DOUBLE PRECISION NOT NULL DEFAULT 0,
      mes4              DOUBLE PRECISION NOT NULL DEFAULT 0,
      creado_por        INTEGER REFERENCES usuarios(id),
      created_at        TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
      updated_at        TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
      UNIQUE(ejercicio_fiscal, cuatrimestre, renglon, subproducto, tipo)
    )
  `;
  console.log("✓ Tabla programacion_entradas");

  console.log("\n¡Listo!");
}

main().catch(console.error);
