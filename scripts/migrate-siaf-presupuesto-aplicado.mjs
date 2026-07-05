import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  await sql`ALTER TABLE siaf_compras ADD COLUMN IF NOT EXISTS presupuesto_aplicado BOOLEAN NOT NULL DEFAULT false`;
  console.log("✓ Columna presupuesto_aplicado en siaf_compras");

  console.log("\n¡Listo!");
}

main().catch(console.error);
