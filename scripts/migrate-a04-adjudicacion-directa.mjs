import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS numero_a04 INTEGER`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS anio_a04 INTEGER`;
  console.log("✓ Columnas numero_a04 / anio_a04 en consolidaciones");

  console.log("\n¡Listo!");
}

main().catch(console.error);
