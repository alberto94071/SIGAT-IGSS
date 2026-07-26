import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  await sql`ALTER TABLE presupuesto_renglones ADD COLUMN IF NOT EXISTS devengado_regularizado DOUBLE PRECISION NOT NULL DEFAULT 0`;
  console.log("✓ Columna presupuesto_renglones.devengado_regularizado");

  await sql`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS dab60_generado_en TEXT`;
  console.log("✓ Columna ordenes_compra.dab60_generado_en");

  console.log("\n¡Listo!");
}

main().catch(console.error);
