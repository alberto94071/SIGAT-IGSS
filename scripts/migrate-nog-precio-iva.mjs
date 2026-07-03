import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  await sql`ALTER TABLE nog_registros ADD COLUMN IF NOT EXISTS precio DOUBLE PRECISION`;
  await sql`ALTER TABLE nog_registros ADD COLUMN IF NOT EXISTS exento_iva BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE nog_registros ADD COLUMN IF NOT EXISTS total DOUBLE PRECISION`;
  console.log("✓ Columnas precio / exento_iva / total en nog_registros");

  console.log("\n¡Listo!");
}

main().catch(console.error);
