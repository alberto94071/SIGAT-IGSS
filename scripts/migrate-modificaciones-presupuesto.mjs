import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  await sql`ALTER TABLE presupuesto_renglones ADD COLUMN IF NOT EXISTS modificacion_ingru DOUBLE PRECISION NOT NULL DEFAULT 0`;
  console.log("✓ Columna presupuesto_renglones.modificacion_ingru");

  await sql`ALTER TABLE presupuesto_renglones ADD COLUMN IF NOT EXISTS modificacion_entre_renglones DOUBLE PRECISION NOT NULL DEFAULT 0`;
  console.log("✓ Columna presupuesto_renglones.modificacion_entre_renglones");

  await sql`ALTER TABLE presupuesto_renglones ADD COLUMN IF NOT EXISTS modificacion_ampliacion DOUBLE PRECISION NOT NULL DEFAULT 0`;
  console.log("✓ Columna presupuesto_renglones.modificacion_ampliacion");

  console.log("\n¡Listo!");
}

main().catch(console.error);
